<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain\Store;

use OCA\Honeycomb\Domain\FolderSummary;

/** Where the folder summaries are kept, one per folder for every user; a scan computes them again (FOLDERS-005). */
interface FolderSummaryStore extends FileRowStore, SharedCacheRows {
	/**
	 * The stored summaries among `$fileIds`, by folder file id.
	 * @param list<int> $fileIds
	 * @return array<int, FolderSummary>
	 */
	public function find(array $fileIds): array;

	/**
	 * Stores `$summaries` in place of the stored summaries of their folders, all or nothing.
	 * @param list<FolderSummary> $summaries each of another folder
	 */
	public function replace(array $summaries): void;

	/**
	 * Drops the summaries of `$fileIds`, so the next scan computes them again.
	 * @param list<int> $fileIds folder file ids
	 */
	public function drop(array $fileIds): void;
}
