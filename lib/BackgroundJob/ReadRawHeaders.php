<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\BackgroundJob;

use OCA\Honeycomb\Domain\Store\FolderSummaryStore;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\QueuedJob;
use OCP\Files\File;
use OCP\Files\IRootFolder;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IUserManager;
use Psr\Log\LoggerInterface;

/** Writes the RAW header key of files that lack it and drops the summaries of their folders (LISTING-004.17, ADR 0061). */
final class ReadRawHeaders extends QueuedJob {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it from the job list. */
	public function __construct(
		ITimeFactory $time,
		private IUserManager $users,
		private IRootFolder $root,
		private IFilesMetadataManager $metadataManager,
		private FolderSummaryStore $summaries,
		private LoggerInterface $logger,
	) {
		parent::__construct($time);
	}

	/** @param mixed $argument `['userId' => string, 'fileIds' => list<int>]`, as `RawHeaderBackfill` queues it */
	#[\Override]
	protected function run($argument): void {
		$userId = is_array($argument) ? ($argument['userId'] ?? null) : null;
		$fileIds = self::fileIds(is_array($argument) ? ($argument['fileIds'] ?? null) : null);
		if (!is_string($userId) || $fileIds === null) {
			$this->logger->warning('RAW header job without a user and file ids', ['argument' => $argument]);
			return;
		}
		if (!$this->users->userExists($userId)) {
			$this->logger->warning('RAW header job for a user without files', ['userId' => $userId]);
			return;
		}
		$userFolder = $this->root->getUserFolder($userId);
		$folders = [];
		foreach ($fileIds as $fileId) {
			$file = $userFolder->getFirstNodeById($fileId);
			if (!$file instanceof File) {
				continue;
			}
			try {
				// As `occ files:scan --generate-metadata`: live, and the background run at once where the listener asks for it.
				$metadata = $this->metadataManager->refreshMetadata($file, IFilesMetadataManager::PROCESS_LIVE | IFilesMetadataManager::PROCESS_BACKGROUND);
			} catch (\Throwable $e) {
				$this->logger->warning('Could not read the RAW header of a file', ['fileId' => $fileId, 'exception' => $e]);
				continue;
			}
			// Only a folder whose file got the key is scanned again, so an unreadable file cannot loop scan and job.
			if ($metadata->hasKey(RawExif::KEY)) {
				$folders[$file->getParent()->getId()] = true;
			}
		}
		if ($folders !== []) {
			$this->summaries->drop(array_keys($folders));
		}
	}

	/** @return ?list<int> the ids, null for anything but a list of ints */
	private static function fileIds(mixed $value): ?array {
		if (!is_array($value) || !array_is_list($value)) {
			return null;
		}
		$ids = [];
		foreach ($value as $id) {
			if (!is_int($id)) {
				return null;
			}
			$ids[] = $id;
		}
		return $ids;
	}
}
