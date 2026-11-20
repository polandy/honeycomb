<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the visual hashes are kept, one per file id with the etag they were taken from, for every user (ADR 0024, ADR 0046). */
interface VisualHashStore extends FileRowStore, SharedCacheRows {
	/**
	 * The stored hashes among `$fileIds`, by file id.
	 * @param list<int> $fileIds
	 * @return array<int, VisualHash>
	 */
	public function find(array $fileIds): array;

	/**
	 * Stores `$hashes` in place of the stored hashes of their files, all or nothing.
	 * @param list<VisualHash> $hashes each of another file
	 */
	public function replace(array $hashes): void;
}
