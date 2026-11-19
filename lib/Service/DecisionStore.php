<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the decisions of each user are kept, by file id. */
interface DecisionStore extends FileRowStore {
	/**
	 * The stored decisions among `$fileIds`, in file id order.
	 * @param list<int> $fileIds
	 * @return list<PictureDecision>
	 */
	public function find(string $userId, array $fileIds): array;

	/**
	 * Removes the decisions of `$fileIds` and stores `$decisions`, all or nothing.
	 * @param list<int> $fileIds
	 * @param list<PictureDecision> $decisions
	 */
	public function replace(string $userId, array $fileIds, array $decisions): void;
}
