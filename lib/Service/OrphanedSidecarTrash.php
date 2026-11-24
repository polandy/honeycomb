<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\Files\File;
use OCP\Files\GenericFileException;
use OCP\Files\InvalidPathException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageNotAvailableException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Moves confirmed orphaned sidecars into the trash bin, each checked again, never deleted for good (XMP-009, ADR 0047). */
final class OrphanedSidecarTrash {
	public function __construct(
		private UserPhotos $photos,
		private IAppManager $appManager,
		private TrashBinGuard $trashBinGuard,
		private TrashNameSpacing $spacing,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Trashes each sidecar that is still unchanged and orphaned, and reports each in the order sent.
	 * @param array<array-key, mixed> $sidecars
	 * @return list<array{fileId: int, result: TrashResult}>
	 * @throws InvalidTrashRequestException for a malformed request; nothing is touched
	 * @throws TrashBinDisabledException when deleting would not be restorable; nothing is touched
	 */
	public function trash(IUser $user, array $sidecars): array {
		$sidecars = self::parse($sidecars);
		if (!$this->appManager->isEnabledForUser('files_trashbin', $user)) {
			throw new TrashBinDisabledException('The trash bin is disabled for the user');
		}
		$userFolder = $this->photos->userFolder($user);
		$results = [];
		foreach ($sidecars as $sidecar) {
			$file = $this->photos->sidecar($userFolder, $sidecar['fileId']);
			$result = $file === null ? TrashResult::NotFound : $this->check($user, $file, $sidecar['etag']);
			if ($file !== null && $result === TrashResult::Trashed) {
				$result = $this->spacing->trash($file->getName(), fn (): TrashResult => $this->delete($file));
			}
			$results[] = ['fileId' => $sidecar['fileId'], 'result' => $result];
		}
		return $results;
	}

	/** `Trashed` when the sidecar may go, else why it stays. */
	private function check(IUser $user, File $file, string $etag): TrashResult {
		if ($file->getEtag() !== $etag) {
			return TrashResult::Changed;
		}
		if (!$file->isDeletable() || !OrphanedSidecarRule::isOwnStorage($file)) {
			return TrashResult::NotPermitted;
		}
		try {
			if (!OrphanedSidecarRule::isOrphan($file, $file->getParent()->getDirectoryListing())) {
				return TrashResult::NotOrphaned;
			}
		} catch (NotFoundException) {
			return TrashResult::NotFound;
		} catch (NotPermittedException) {
			return TrashResult::NotPermitted;
		}
		return $this->trashBinGuard->refusal($user->getUID(), $file) ?? TrashResult::Trashed;
	}

	/** Moves the sidecar into the trash bin and returns `Trashed` or the failure. */
	private function delete(File $file): TrashResult {
		$fileId = $file->getId();
		try {
			$file->delete();
			return TrashResult::Trashed;
		} catch (NotPermittedException) {
			return TrashResult::NotPermitted;
		} catch (LockedException) {
			return TrashResult::Locked;
		} catch (NotFoundException) {
			return TrashResult::NotFound;
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException $e) {
			$this->logger->warning('An orphaned sidecar could not be moved to the trash bin', ['fileId' => $fileId, 'exception' => $e]);
			return TrashResult::Failed;
		}
	}

	/**
	 * @param array<array-key, mixed> $sidecars
	 * @return list<array{fileId: int, etag: string}>
	 * @throws InvalidTrashRequestException
	 */
	private static function parse(array $sidecars): array {
		if (!array_is_list($sidecars)) {
			throw new InvalidTrashRequestException('sidecars must be a list');
		}
		if (count($sidecars) > PictureRequestLimit::FILES) {
			throw new InvalidTrashRequestException('At most ' . PictureRequestLimit::FILES . ' sidecars');
		}
		$parsed = [];
		/** @var mixed $sidecar */
		foreach ($sidecars as $sidecar) {
			$fileId = is_array($sidecar) ? $sidecar['fileId'] ?? null : null;
			$etag = is_array($sidecar) ? $sidecar['etag'] ?? null : null;
			if (!is_int($fileId) || $fileId < 1 || !is_string($etag) || $etag === '') {
				throw new InvalidTrashRequestException('Each sidecar must have a positive fileId and an etag');
			}
			$parsed[] = ['fileId' => $fileId, 'etag' => $etag];
		}
		FileIds::eachOnce(array_column($parsed, 'fileId'), InvalidTrashRequestException::class);
		return $parsed;
	}
}
