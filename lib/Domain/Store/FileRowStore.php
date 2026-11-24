<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain\Store;

/** Rows kept per file id, which follow a file and go with it. */
interface FileRowStore {
	/**
	 * Moves every row of `$fileId`, whoever's it is, to `$newFileId`: a shared file has one file id for all its users.
	 * @throws \OCP\DB\Exception
	 */
	public function carryOver(int $fileId, int $newFileId): void;

	/**
	 * The file ids of at most `$limit` rows, of every user, with a row id above `$afterId`, in row id order.
	 * @return array<int, int> row id to file id
	 * @throws \OCP\DB\Exception
	 */
	public function fileIdsAfter(int $afterId, int $limit): array;

	/**
	 * Removes the rows with these row ids and returns how many.
	 * @param list<int> $ids
	 * @throws \OCP\DB\Exception
	 */
	public function deleteRows(array $ids): int;
}
