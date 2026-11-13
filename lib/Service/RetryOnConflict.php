<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\DB\Exception as DbException;

/**
 * Two saves of one file at once both pass the delete and the second insert hits the unique key;
 * the winner has committed by then, so the same save now replaces its row (last writer wins).
 */
final class RetryOnConflict {
	/** A save tries this often; each repeat follows a concurrent save of the same file committing first. */
	private const int ATTEMPTS = 3;

	/**
	 * Runs `$save`, again after a unique key conflict.
	 * @param callable(): void $save
	 * @throws DbException for any other database error, or a conflict on every attempt
	 */
	public static function run(callable $save): void {
		for ($attempt = 1;; ++$attempt) {
			try {
				$save();
				return;
			} catch (DbException $e) {
				if ($e->getReason() !== DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION || $attempt >= self::ATTEMPTS) {
					throw $e;
				}
			}
		}
	}
}
