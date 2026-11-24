<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain\Store;

/** Everything honeycomb stores for its users: the rows of its tables and its rows in the users' preferences. */
interface AppData {
	/**
	 * How many rows each table holds, by table name without the instance's prefix.
	 * @return array<string, int>
	 * @throws \OCP\DB\Exception
	 */
	public function count(): array;

	/**
	 * Deletes every row and returns how many went from each table; the tables themselves stay.
	 * @return array<string, int>
	 * @throws \OCP\DB\Exception
	 */
	public function empty(): array;
}
