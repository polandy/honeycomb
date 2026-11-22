<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderDone;
use OCA\Honeycomb\Service\FolderDoneStore;

/** Keeps the done statuses in memory, by the folder's file id. */
final class FakeFolderDoneStore implements FolderDoneStore {
	use FakeRowsByFile;

	/** @var array<int, FolderDone> */
	public array $rows = [];

	#[\Override]
	public function find(array $fileIds): array {
		return array_intersect_key($this->rows, array_flip($fileIds));
	}

	/** The row moved to `$fileId`. */
	private static function movedTo(FolderDone $row, int $fileId): FolderDone {
		return new FolderDone($fileId, $row->userId, $row->doneAt, $row->photos);
	}
}
