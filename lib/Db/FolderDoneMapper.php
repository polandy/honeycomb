<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\FolderDone;
use OCA\Honeycomb\Service\FolderDoneStore;
use OCP\IDBConnection;

/** Keeps the one done status of each folder in `honeycomb_folder_done` (ADR 0049). */
final class FolderDoneMapper implements FolderDoneStore {
	use FileRowQueries;

	private const string TABLE = 'honeycomb_folder_done';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** The table, without the instance's prefix. */
	#[\Override]
	public function getTableName(): string {
		return self::TABLE;
	}

	#[\Override]
	public function find(array $fileIds): array {
		$done = [];
		foreach ($this->findFileRows(null, $fileIds) as $row) {
			$status = new FolderDone((int)$row['file_id'], (string)$row['user_id'], (int)$row['done_at'], (int)$row['photos']);
			$done[$status->fileId] = $status;
		}
		return $done;
	}

	/** A folder's done status follows it to the new file id, whoever moves it. */
	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$this->carryFileRow($fileId, $newFileId);
	}
}
