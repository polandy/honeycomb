<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The stored series of each user: one row per member or kept-out file, one per series (ADR 0027). */
interface SeriesStore extends FileRowStore, UserRowStore {
	/**
	 * The user's series with members among `$fileIds`, and the kept-out files among them.
	 * @param list<int> $fileIds
	 */
	public function find(string $userId, array $fileIds): SeriesLookup;

	/**
	 * Writes the whole state in `$write`, all or nothing; a new series id for a null id or one the user does not have.
	 * @return array{ids: list<int>, done: int} the id of each series item, and how many series became done
	 * @throws \OCP\DB\Exception
	 */
	public function write(string $userId, SeriesWrite $write): array;

	/** How many series of the user are done. */
	public function countDone(string $userId): int;

	/**
	 * The ids of at most `$limit` series of every user above `$afterId`, in id order.
	 * @return list<int>
	 * @throws \OCP\DB\Exception
	 */
	public function seriesIdsAfter(int $afterId, int $limit): array;

	/**
	 * Removes the series among `$ids` without a member row and returns how many.
	 * @param list<int> $ids
	 * @throws \OCP\DB\Exception
	 */
	public function deleteEmptySeries(array $ids): int;
}
