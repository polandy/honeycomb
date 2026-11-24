<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\SeriesStatus;
use OCA\Honeycomb\Service\EmptySeriesSweep;
use OCP\DB\Exception as DbException;
use PHPUnit\Framework\TestCase;

final class EmptySeriesSweepTest extends TestCase {
	use AppConfigStub;

	private const string KEY = 'empty_series_after';
	private const int CHUNK = 1_000;

	private FakeSeriesStore $store;
	private EmptySeriesSweep $sweep;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeSeriesStore();
		$this->sweep = new EmptySeriesSweep($this->store, $this->appConfigStub());
	}

	// spec: SERIES-005.25
	public function testRemovesTheSeriesWithoutARowOfEveryUserAndKeepsALoneMember(): void {
		$lone = $this->store->add('alice', SeriesStatus::Open, 7);
		$this->store->add('alice', SeriesStatus::Done);
		$this->store->add('bob', SeriesStatus::Open);
		$this->store->rows['bob'][8] = null;
		$this->assertSame(2, $this->sweep->sweep());
		$this->assertSame([$lone], array_keys($this->store->series));
		$this->assertSame(0, $this->appConfig[self::KEY]);
	}

	// spec: SERIES-005.25
	public function testWalksEverySeriesBeyondOneChunk(): void {
		for ($i = 0; $i <= self::CHUNK; ++$i) {
			$this->store->add('alice', SeriesStatus::Open);
		}
		$kept = $this->store->add('alice', SeriesStatus::Open, 7);
		$this->assertSame(self::CHUNK + 1, $this->sweep->sweep());
		$this->assertSame([$kept], array_keys($this->store->series));
	}

	public function testAFailedReadReachesTheCaller(): void {
		$this->store->seriesReadFails = true;
		$this->expectException(DbException::class);
		$this->sweep->sweep();
	}
}
