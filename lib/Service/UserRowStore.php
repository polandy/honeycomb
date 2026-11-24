<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Rows each user keeps, or names, that go with the user. */
interface UserRowStore {
	/** Removes every row of the user, or empties the user's name in a row that stays. */
	public function forgetUser(string $userId): void;
}
