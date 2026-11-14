<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the visual hashes of each user are kept, by file id with the etag they were taken from (ADR 0024). */
interface VisualHashStore extends FileRowStore {
	/**
	 * The stored hashes among `$fileIds`, by file id.
	 * @param list<int> $fileIds
	 * @return array<int, VisualHash>
	 */
	public function find(string $userId, array $fileIds): array;

	/**
	 * Stores `$hashes` in place of the user's stored hashes of their files, all or nothing.
	 * @param list<VisualHash> $hashes each of another file
	 */
	public function replace(string $userId, array $hashes): void;
}
