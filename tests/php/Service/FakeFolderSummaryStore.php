<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderSummary;
use OCA\Honeycomb\Service\FolderSummaryStore;

/** Keeps folder summaries in memory, by the folder's file id. */
final class FakeFolderSummaryStore implements FolderSummaryStore {
	use FakeRowsByFile;
	use FakeSharedCacheRows;

	/** @var array<int, FolderSummary> */
	public array $rows = [];

	/** @var list<list<int>> The file ids of each `replace()` call. */
	public array $replaced = [];

	#[\Override]
	public function find(array $fileIds): array {
		return array_intersect_key($this->rows, array_flip($fileIds));
	}

	#[\Override]
	public function replace(array $summaries): void {
		$this->replaced[] = array_map(static fn (FolderSummary $summary): int => $summary->fileId, $summaries);
		foreach ($summaries as $summary) {
			$this->rows[$summary->fileId] = $summary;
		}
	}

	/** The row moved to `$fileId`. */
	private static function movedTo(FolderSummary $row, int $fileId): FolderSummary {
		return new FolderSummary($fileId, $row->etag, $row->photos, $row->bytes, $row->rawBytes, $row->bursts, $row->oldest, $row->newest, $row->lastActivity, $row->scannedAt);
	}
}
