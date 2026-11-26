<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** The connections' resume positions, one per user and connection (IMMICH-003.23). */
interface ImmichPositionStore {
	/**
	 * The user's positions, the latest saved first.
	 * @return list<ImmichPosition>
	 */
	public function all(string $userId): array;

	/** Replaces the user's position of the connection. */
	public function save(string $userId, ImmichPosition $position): void;

	/**
	 * Removes every position whose connection and user are not among the pairs, and answers how many.
	 * @param list<array{string, string}> $kept (connection id, user id)
	 */
	public function keepOnly(array $kept): int;
}
