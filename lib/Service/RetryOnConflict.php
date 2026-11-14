<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\DB\Exception as DbException;

/**
 * Two saves of one file at once both pass the delete and the second insert hits the unique key,
 * or on MySQL deadlocks or times out on the other's locks; the save's transaction is rolled back,
 * so repeating it replaces the winner's row (last writer wins).
 */
final class RetryOnConflict {
	/** A save tries this often; each repeat follows a concurrent save of the same file committing first. */
	private const int ATTEMPTS = 3;

	/** The database errors a concurrent save of the same file causes. */
	private const array REPEATED_REASONS = [
		DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION,
		DbException::REASON_DEADLOCK,
		DbException::REASON_LOCK_WAIT_TIMEOUT,
	];

	/**
	 * Runs `$save`, again after a unique key conflict, a deadlock or a lock wait timeout.
	 * @param callable(): void $save
	 * @throws DbException for any other database error, or one of these on every attempt
	 */
	public static function run(callable $save): void {
		for ($attempt = 1;; ++$attempt) {
			try {
				$save();
				return;
			} catch (DbException $e) {
				if (!in_array($e->getReason(), self::REPEATED_REASONS, true) || $attempt >= self::ATTEMPTS) {
					throw $e;
				}
			}
		}
	}
}
