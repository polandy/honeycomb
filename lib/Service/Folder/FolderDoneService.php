<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Folder;

use OCA\Honeycomb\Domain\DoneSkip;
use OCA\Honeycomb\Domain\FolderDone;
use OCA\Honeycomb\Domain\FolderDoneBatch;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Domain\Store\FolderDoneStore;
use OCA\Honeycomb\Service\Files\FolderNotFoundException;
use OCA\Honeycomb\Service\Files\FolderNotReadableException;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Stats\StatsCount;
use OCA\Honeycomb\Service\Stats\StatsService;
use OCA\Honeycomb\Service\Support\RetryOnConflict;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Files\Folder;
use OCP\IUser;

/** Marks a folder or a batch done and reopens them, counting each mark (FOLDERS-006, ADR 0049, ADR 0060). */
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
	 * @throws InvalidRequestException for a `$photos` that is no whole number from 0
	 * @throws FolderNotFoundException when `$fileId` is no folder of the user's own files
	 * @throws FolderNotReadableException when the user may not read or rate the folder
	 * @throws \OCP\DB\Exception
	 */
	public function mark(IUser $user, int $fileId, mixed $photos): FolderDone {
		$photos = FolderDoneRequest::photos($photos);
		if (!$this->rateable($this->photos->userFolder($user), $fileId)) {
			throw new FolderNotReadableException((string)$fileId);
		}
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
		$this->reopenAll($user, [$fileId]);
	}

	/**
	 * Marks each rateable folder of `$folders` that is not done, in one write, and counts each;
	 * a read-only or done folder is skipped and keeps its status.
	 * @throws InvalidRequestException for a malformed body, before any lookup
	 * @throws FolderNotFoundException when a folder is none of the user's own, and nothing is written
	 * @throws FolderNotReadableException when the user may not read a folder, and nothing is written
	 * @throws \OCP\DB\Exception
	 */
	public function markAll(IUser $user, mixed $folders): FolderDoneBatch {
		$marks = FolderDoneRequest::marks($folders);
		$userFolder = $this->photos->userFolder($user);
		$known = $this->store->find(array_keys($marks));
		$now = $this->time->getTime();
		$done = [];
		$skipped = [];
		foreach ($marks as $fileId => $photos) {
			if (!$this->rateable($userFolder, $fileId)) {
				$skipped[$fileId] = DoneSkip::ReadOnly;
			} elseif (isset($known[$fileId])) {
				$skipped[$fileId] = DoneSkip::Done;
			} else {
				$done[] = new FolderDone($fileId, $user->getUID(), $now, $photos);
			}
		}
		if ($done !== []) {
			RetryOnConflict::run(fn () => $this->store->put(...$done));
			$this->stats->count($user, new StatsCount(StatsMetric::FoldersDone, count($done)));
		}
		return new FolderDoneBatch($done, $skipped);
	}

	/**
	 * Removes the status of each folder of `$fileIds` in one write; a folder that is not done is no error.
	 * @throws InvalidRequestException for a malformed body, before any lookup
	 * @throws FolderNotFoundException when a folder is none of the user's own, and nothing is written
	 * @throws FolderNotReadableException when the user may not read or rate a folder, and nothing is written
	 * @throws \OCP\DB\Exception
	 */
	public function reopenAll(IUser $user, mixed $fileIds): void {
		$fileIds = FolderDoneRequest::fileIds($fileIds);
		$userFolder = $this->photos->userFolder($user);
		foreach ($fileIds as $fileId) {
			if (!$this->rateable($userFolder, $fileId)) {
				throw new FolderNotReadableException((string)$fileId);
			}
		}
		RetryOnConflict::run(fn () => $this->store->remove(...$fileIds));
	}

	/**
	 * Whether the user may rate `$fileId`, rechecked as a folder of the user's own storage they may read.
	 * @throws FolderNotFoundException
	 * @throws FolderNotReadableException
	 */
	private function rateable(Folder $userFolder, int $fileId): bool {
		$folder = $userFolder->getFirstNodeById($fileId);
		if (!$folder instanceof Folder || $folder->getMountPoint()->getMountType() !== self::OWN_MOUNT) {
			throw new FolderNotFoundException((string)$fileId);
		}
		if (!$folder->isReadable()) {
			throw new FolderNotReadableException((string)$fileId);
		}
		return $this->photos->folderRateable($folder);
	}
}
