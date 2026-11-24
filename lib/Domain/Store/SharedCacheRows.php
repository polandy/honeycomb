<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain\Store;

/** Rows of every user that the browser computes again from the files, so clearing them loses nothing (ADR 0032, ADR 0046). */
interface SharedCacheRows {
	/**
	 * Removes every row and returns how many.
	 * @throws \OCP\DB\Exception
	 */
	public function clearAll(): int;
}
