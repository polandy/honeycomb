<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the quality values are kept, one per file id with the etag they were measured on, for every user (ADR 0046). */
interface QualityStore extends FileRowStore, SharedCacheRows {
	/**
	 * The stored values among `$fileIds`, by file id.
	 * @param list<int> $fileIds
	 * @return array<int, QualityValue>
	 */
	public function find(array $fileIds): array;

	/**
	 * Stores `$values` in place of the stored values of their files, all or nothing.
	 * @param list<QualityValue> $values each of another file
	 */
	public function replace(array $values): void;
}
