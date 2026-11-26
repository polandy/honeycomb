<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Stats;

use OCA\Honeycomb\Service\Stats\StatsReset;
use OCA\Honeycomb\Tests\Service\FakeStatsStore;
use PHPUnit\Framework\TestCase;

final class StatsResetTest extends TestCase {
	private FakeStatsStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeStatsStore();
		$this->store->rows = [
			'alice' => ['2026-02-01' => ['series_done' => 1, 'trash_files' => 2], '2026-02-10' => ['trash_files' => 4]],
			'bob' => ['2026-02-10' => ['series_done' => 9]],
		];
	}

	// spec: STATS-001.3
	public function testCountsTheRowsOfOneUserOrOfEveryUserAndDeletesNothing(): void {
		$reset = new StatsReset($this->store);

		$this->assertSame(['alice' => 3], $reset->rows('alice'));
		$this->assertSame(['alice' => 3, 'bob' => 1], $reset->rows(null));
		$this->assertCount(2, $this->store->rows);
	}

	// spec: STATS-001.3
	public function testResetDeletesOneUsersRowsOnlyAndAnswersTheCount(): void {
		$deleted = (new StatsReset($this->store))->reset('alice');

		$this->assertSame(['alice' => 3], $deleted);
		$this->assertSame(['bob' => ['2026-02-10' => ['series_done' => 9]]], $this->store->rows);
	}

	// spec: STATS-001.3
	public function testResetOfEveryUserDeletesAllRows(): void {
		$deleted = (new StatsReset($this->store))->reset(null);

		$this->assertSame(['alice' => 3, 'bob' => 1], $deleted);
		$this->assertSame([], $this->store->rows);
	}

	// spec: STATS-001.3
	public function testAUserWithoutRowsHasNothingToDelete(): void {
		$reset = new StatsReset($this->store);

		$this->assertSame([], $reset->reset('carol'));
		$this->assertCount(2, $this->store->rows);
	}
}
