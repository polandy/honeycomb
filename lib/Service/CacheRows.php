<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Rows honeycomb can read again from the files, so clearing them loses nothing (ADR 0032). */
interface CacheRows {
	/**
	 * Removes the rows of `$userId`, or of every user for null, and returns how many.
	 * @throws \OCP\DB\Exception
	 */
	public function clear(?string $userId): int;
}
