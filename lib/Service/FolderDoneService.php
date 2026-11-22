<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Files\Folder;
use OCP\IUser;

/** Marks a folder done and reopens it, counting each mark (FOLDERS-006, ADR 0049). */
final class FolderDoneService {
	private const string OWN_MOUNT = '';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private UserPhotos $photos,
		private FolderDoneStore $store,
		private ITimeFactory $time,
		private StatsService $stats,
	) {
	}

	/**
	 * Marks the folder done by the user, replacing an earlier status, and counts it.
	 * @throws InvalidLibraryRequestException for a `$photos` that is no whole number from 0
	 * @throws FolderNotFoundException when `$fileId` is no folder of the user's own files
	 * @throws FolderNotReadableException when the user may not read or rate the folder
	 * @throws \OCP\DB\Exception
	 */
	public function mark(IUser $user, int $fileId, mixed $photos): FolderDone {
		if (!is_int($photos) || $photos < 0) {
			throw new InvalidLibraryRequestException('photos must be a whole number from 0');
		}
		$this->rateableFolder($user, $fileId);
		$done = new FolderDone($fileId, $user->getUID(), $this->time->getTime(), $photos);
		RetryOnConflict::run(fn () => $this->store->put($done));
		$this->stats->count($user, new StatsCount(StatsMetric::FoldersDone, 1));
		return $done;
	}

	/**
	 * Removes the folder's status; a folder that is not done is no error.
	 * @throws FolderNotFoundException when `$fileId` is no folder of the user's own files
	 * @throws FolderNotReadableException when the user may not read or rate the folder
	 * @throws \OCP\DB\Exception
	 */
	public function reopen(IUser $user, int $fileId): void {
		$this->rateableFolder($user, $fileId);
		$this->store->remove($fileId);
	}

	/**
	 * The folder of the user's own storage with `$fileId`, rechecked.
	 * @throws FolderNotFoundException
	 * @throws FolderNotReadableException
	 */
	private function rateableFolder(IUser $user, int $fileId): Folder {
		$folder = $this->photos->userFolder($user)->getFirstNodeById($fileId);
		if (!$folder instanceof Folder || $folder->getMountPoint()->getMountType() !== self::OWN_MOUNT) {
			throw new FolderNotFoundException((string)$fileId);
		}
		if (!$folder->isReadable() || !$this->photos->folderRateable($folder)) {
			throw new FolderNotReadableException((string)$fileId);
		}
		return $folder;
	}
}
