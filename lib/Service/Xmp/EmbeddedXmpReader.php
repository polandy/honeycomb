<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Xmp;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Sidecar\SidecarRequest;
use OCA\Honeycomb\Service\Sidecar\SidecarResult;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\GenericFileException;
use OCP\Files\InvalidPathException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageNotAvailableException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Hands the client the XMP packet each listed JPEG embeds (ADR 0023). */
final class EmbeddedXmpReader {

	public function __construct(
		private UserPhotos $photos,
		private JpegXmp $jpegXmp,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Reads each JPEG's packet and reports each, in the order sent.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<array{fileId: int, result: SidecarResult, content?: string}>
	 * @throws InvalidRequestException for a malformed request; nothing is read
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$fileIds = SidecarRequest::fileIds($fileIds);
		$userFolder = $this->photos->userFolder($user);
		return array_map(fn (int $fileId): array => ['fileId' => $fileId, ...$this->read($userFolder, $fileId)], $fileIds);
	}

	/** @return array{result: SidecarResult, content?: string} */
	private function read(Folder $userFolder, int $fileId): array {
		$node = $this->photos->jpeg($userFolder, $fileId);
		if ($node === null) {
			return ['result' => SidecarResult::NotFound];
		}
		if (!$node->isReadable()) {
			return ['result' => SidecarResult::NotPermitted];
		}
		try {
			$packet = $this->packetOf($node);
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException|NotPermittedException|LockedException|NotFoundException $e) {
			$result = SidecarResult::ofFailure($e);
			if ($result === SidecarResult::Failed) {
				$this->logger->warning('The embedded XMP of a JPEG could not be read', ['fileId' => $fileId, 'exception' => $e]);
			}
			return ['result' => $result];
		}
		return $packet === null ? ['result' => SidecarResult::NoPacket] : ['result' => SidecarResult::Read, 'content' => base64_encode($packet)];
	}

	/** @throws \Exception when the JPEG cannot be opened */
	private function packetOf(File $jpeg): ?string {
		$stream = $jpeg->fopen('r');
		if ($stream === false) {
			throw new GenericFileException('The JPEG could not be opened');
		}
		try {
			return $this->jpegXmp->packet($stream);
		} finally {
			fclose($stream);
		}
	}
}
