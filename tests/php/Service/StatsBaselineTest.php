<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\SeriesStatus;
use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Domain\XmpCacheRow;
use OCA\Honeycomb\Domain\XmpReadState;
use OCA\Honeycomb\Domain\XmpSource;
use OCA\Honeycomb\Service\StatsBaseline;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

final class StatsBaselineTest extends TestCase {
	private FakeSeriesStore $series;
	private FakeStatsStore $stats;
	private FakeXmpCacheStore $cache;

	#[\Override]
	protected function setUp(): void {
		$this->series = new FakeSeriesStore();
		$this->stats = new FakeStatsStore();
		$this->cache = new FakeXmpCacheStore();
	}

	private function of(string $uid = 'alice'): array {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return (new StatsBaseline($this->series, $this->stats, $this->cache))->of($user);
	}

	private function row(int $fileId, XmpReadState $state, ?Flag $flag, ?int $rating): XmpCacheRow {
		return new XmpCacheRow($fileId, XmpSource::Sidecar, 'etag', 1, $state, $state === XmpReadState::Refused ? 'not-utf-8' : null, $rating, $flag, null, null, null);
	}

	// spec: STATS-001.44
	public function testSeriesDoneBeforeAreTheDoneSeriesNoCounterHolds(): void {
		foreach ([1, 2, 3, 4, 5] as $fileId) {
			$this->series->add('alice', SeriesStatus::Done, $fileId);
		}
		$this->series->add('alice', SeriesStatus::Open, 6);
		$this->series->add('bob', SeriesStatus::Done, 7);
		$this->stats->rows['alice'] = ['2026-11-01' => [StatsMetric::SeriesDone->value => 1], '2026-11-19' => [StatsMetric::SeriesDone->value => 1]];

		$this->assertSame(3, $this->of()['seriesDoneBefore']);
	}

	// spec: STATS-001.44
	public function testSeriesDoneBeforeNeverGoBelowZero(): void {
		$this->series->add('alice', SeriesStatus::Done, 1);
		$this->stats->rows['alice'] = ['2026-11-19' => [StatsMetric::SeriesDone->value => 4]];

		$this->assertSame(0, $this->of()['seriesDoneBefore']);
	}

	// spec: STATS-001.45
	public function testReadCountsOnlyTheReadRowsOfTheUser(): void {
		$this->cache->rows['alice'] = [
			1 => $this->row(1, XmpReadState::Read, Flag::Picked, 3),
			2 => $this->row(2, XmpReadState::Read, Flag::Picked, null),
			3 => $this->row(3, XmpReadState::Read, Flag::Rejected, 0),
			4 => $this->row(4, XmpReadState::Read, Flag::Unflagged, 5),
			5 => $this->row(5, XmpReadState::Refused, Flag::Picked, 4),
			6 => $this->row(6, XmpReadState::None, null, null),
		];
		$this->cache->rows['bob'] = [9 => $this->row(9, XmpReadState::Read, Flag::Picked, 1)];

		$this->assertSame(['pictures' => 4, 'picked' => 2, 'rejected' => 1, 'rated' => 2], $this->of()['read']);
	}

	// spec: STATS-001.45
	public function testReadIsZeroWithoutCacheRows(): void {
		$this->assertSame(['pictures' => 0, 'picked' => 0, 'rejected' => 0, 'rated' => 0], $this->of()['read']);
	}
}
