<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Rows each user keeps per file id, which follow a file and go with it or with the user. */
interface FileRowStore extends UserRowStore {
	/** Moves the user's row of `$fileId`, if there is one, to `$newFileId`. */
	public function carryOver(string $userId, int $fileId, int $newFileId): void;

	/**
	 * The file ids of at most `$limit` rows of every user with a row id above `$afterId`, in row id order.
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
