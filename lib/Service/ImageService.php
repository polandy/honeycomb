<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\BackgroundJob\GeneratePreviews;
use OCP\BackgroundJob\IJobList;
use OCP\Files\File;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\SimpleFS\ISimpleFile;
use OCP\IPreview;
use OCP\IUser;
use Psr\Log\LoggerInterface;

/** Finds a user's image files by id and renders, warms and queues their preview tiers (ADR 0010). */
final class ImageService {
	/** Long edge in pixels: grid tiles, large grid tiles, loupe (`docs/plan.md` Image delivery). */
	public const array TIERS = [256, 512, 2048];
	/** The tier of the full image, for the loupe's 100 % zoom; no long-edge limit. */
	public const int FULL = 0;
	/** Types every browser shows, served as the file itself at full size. */
	private const array BROWSER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
	/** Keeps a job's JSON argument below the 4,000 characters of the job table. */
	public const int FILE_IDS_PER_JOB = 200;

	public function __construct(
		private IRootFolder $rootFolder,
		private IPreview $preview,
		private IJobList $jobList,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * The image file with `$fileId` in the user's files.
	 * @throws ImageNotFoundException for a missing, foreign or non-image id
	 * @throws ImageNotReadableException when the user may not read it
	 */
	public function find(IUser $user, int $fileId): File {
		$node = $this->rootFolder->getUserFolder($user->getUID())->getFirstNodeById($fileId);
		if (!$node instanceof File || !ListingService::isPhoto($node)) {
			throw new ImageNotFoundException("No image file $fileId in the user's files");
		}
		if (!$node->isReadable()) {
			throw new ImageNotReadableException("Image file $fileId is not readable");
		}
		return $node;
	}

	/**
	 * The preview of `$file` with at least `$tier` pixels on the long edge where the image has them.
	 * @throws ImageNotFoundException when no preview can be rendered
	 */
	public function preview(File $file, int $tier): ISimpleFile {
		try {
			return $this->preview->getPreview($file, $tier, $tier, false, IPreview::MODE_FILL);
		} catch (NotFoundException|\InvalidArgumentException $e) {
			throw new ImageNotFoundException("No preview of file {$file->getId()}", 0, $e);
		}
	}

	/**
	 * The full image of `$file`: the file itself where browsers show it, else its largest preview.
	 * @throws ImageNotFoundException when no preview can be rendered
	 */
	public function full(File $file): File|ISimpleFile {
		if (in_array($file->getMimetype(), self::BROWSER_TYPES, true)) {
			return $file;
		}
		try {
			return $this->preview->getPreview($file, -1, -1, false);
		} catch (NotFoundException|\InvalidArgumentException $e) {
			throw new ImageNotFoundException("No full preview of file {$file->getId()}", 0, $e);
		}
	}

	/**
	 * Renders every tier of the user's files into the preview cache, skipping what it cannot render.
	 * @param list<int> $fileIds
	 */
	public function warm(IUser $user, array $fileIds): void {
		$specifications = array_map(
			static fn (int $tier): array => ['width' => $tier, 'height' => $tier, 'crop' => false, 'mode' => IPreview::MODE_FILL],
			self::TIERS,
		);
		foreach ($fileIds as $fileId) {
			try {
				$this->preview->generatePreviews($this->find($user, $fileId), $specifications);
			} catch (ImageNotFoundException|ImageNotReadableException|NotFoundException|\InvalidArgumentException $e) {
				$this->logger->debug('No previews warmed for file', ['fileId' => $fileId, 'exception' => $e]);
			}
		}
	}

	/**
	 * Queues background jobs that warm the user's files in the given order.
	 * @param list<int> $fileIds
	 */
	public function queueWarm(IUser $user, array $fileIds): void {
		foreach (array_chunk($fileIds, self::FILE_IDS_PER_JOB) as $chunk) {
			$this->jobList->add(GeneratePreviews::class, ['userId' => $user->getUID(), 'fileIds' => $chunk]);
		}
	}
}
