<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\RetryOnConflict;
use OCP\DB\Exception as DbException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RetryOnConflictTest extends TestCase {
	private int $calls = 0;

	/** @return array<string, array{int}> */
	public static function repeatedReasons(): array {
		return [
			'a unique key conflict' => [DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION],
			'a deadlock' => [DbException::REASON_DEADLOCK],
			'a lock wait timeout' => [DbException::REASON_LOCK_WAIT_TIMEOUT],
		];
	}

	// spec: DECISIONS-001.13, TAGS-001.9
	#[DataProvider('repeatedReasons')]
	public function testRepeatsTheSaveAfterAConcurrentSave(int $reason): void {
		RetryOnConflict::run($this->failing(2, $reason));

		$this->assertSame(3, $this->calls);
	}

	// spec: DECISIONS-001.13, TAGS-001.9
	#[DataProvider('repeatedReasons')]
	public function testGivesUpAfterThreeAttempts(int $reason): void {
		$thrown = $this->thrownBy($this->failing(10, $reason));

		$this->assertSame($reason, $thrown?->getReason());
		$this->assertSame(3, $this->calls);
	}

	// spec: DECISIONS-001.13, TAGS-001.9
	public function testDoesNotRepeatAnotherDatabaseError(): void {
		$thrown = $this->thrownBy($this->failing(1, DbException::REASON_FOREIGN_KEY_VIOLATION));

		$this->assertSame(DbException::REASON_FOREIGN_KEY_VIOLATION, $thrown?->getReason());
		$this->assertSame(1, $this->calls);
	}

	/** @return callable(): void A save whose first `$failures` calls fail with `$reason`. */
	private function failing(int $failures, int $reason): callable {
		return function () use ($failures, $reason): void {
			if (++$this->calls <= $failures) {
				throw new FakeDbException($reason);
			}
		};
	}

	/** @param callable(): void $save */
	private function thrownBy(callable $save): ?DbException {
		try {
			RetryOnConflict::run($save);
		} catch (DbException $e) {
			return $e;
		}
		return null;
	}
}
