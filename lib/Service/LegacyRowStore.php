<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A store whose rows ADR 0032 migrates into sidecars: its file ids per user, and their removal. */
interface LegacyRowStore {
	/**
	 * The file ids the user has a row of, sorted, each once.
	 * @return list<int>
	 * @throws \OCP\DB\Exception
	 */
	public function fileIdsOf(string $userId): array;

	/**
	 * Removes the user's rows of `$fileIds`, nothing else.
	 * @param list<int> $fileIds
	 * @throws \OCP\DB\Exception
	 */
	public function forget(string $userId, array $fileIds): void;
}
