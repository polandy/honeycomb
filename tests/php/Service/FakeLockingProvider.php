<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;

/** Core's locking as another request holds it until a second on the fake clock, and as this request takes it. */
final class FakeLockingProvider implements ILockingProvider {
	/** @var array<string, int> the exclusive locks held, with their type */
	public array $held = [];
	/** @var list<string> every lock released, in order */
	public array $released = [];
	/** @var int how often a lock was asked for */
	public int $attempts = 0;

	public function __construct(
		private FakeClock $clock,
		private int $otherHoldsUntil = PHP_INT_MIN,
	) {
	}

	#[\Override]
	public function isLocked(string $path, int $type): bool {
		return isset($this->held[$path]) || $this->clock->now < $this->otherHoldsUntil;
	}

	#[\Override]
	public function acquireLock(string $path, int $type, ?string $readablePath = null): void {
		$this->attempts++;
		if ($this->isLocked($path, $type)) {
			throw new LockedException($path);
		}
		$this->held[$path] = $type;
	}

	#[\Override]
	public function releaseLock(string $path, int $type): void {
		unset($this->held[$path]);
		$this->released[] = $path;
	}

	#[\Override]
	public function changeLock(string $path, int $targetType): void {
		throw new \LogicException('The preview lock never changes a lock');
	}

	#[\Override]
	public function releaseAll(): void {
		$this->held = [];
	}
}
