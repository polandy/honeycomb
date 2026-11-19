<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the XMP cache of each user is kept, one row per file id with the etag it was read at (ADR 0032). */
interface XmpCacheStore extends FileRowStore, UserRowStore, CacheRows {
	/**
	 * The stored rows among `$fileIds`, by file id.
	 * @param list<int> $fileIds
	 * @return array<int, XmpCacheRow>
	 */
	public function find(string $userId, array $fileIds): array;

	/**
	 * Stores `$rows` in place of the user's stored rows of their files, all or nothing.
	 * @param list<XmpCacheRow> $rows each of another file
	 */
	public function replace(string $userId, array $rows): void;
}
