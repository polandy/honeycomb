<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\Support\Pause;

/** A clock in whole seconds whose pause moves it on instead of sleeping. */
final class FakeClock implements Pause {
	/** @var list<int> the seconds paused until, in order */
	public array $pauses = [];

	public function __construct(
		public int $now = 100,
	) {
	}

	#[\Override]
	public function until(int $second): void {
		$this->pauses[] = $second;
		$this->now = max($this->now, $second);
	}
}
