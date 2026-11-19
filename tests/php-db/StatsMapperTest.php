<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\StatsMapper;
use OCA\Honeycomb\Service\StatsCounter;
use OCA\Honeycomb\Service\StatsMetric;
use OCP\DB\Exception as DbException;

/** The daily counters against a real database. */
final class StatsMapperTest extends DbTestCase {
	private StatsMapper $stats;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->stats = new StatsMapper($this->db);
	}

	public function testAddsToTheRowOfTheDayAndMetric(): void {
		$this->stats->add('alice', '2026-11-19', StatsMetric::TrashFiles, 3);
		$this->stats->add('alice', '2026-11-19', StatsMetric::TrashFiles, 6);
		$this->stats->add('alice', '2026-11-19', StatsMetric::TrashBytes, 5_000_000_000);
		$this->stats->add('alice', '2026-11-20', StatsMetric::TrashFiles, 1);

		$this->assertEquals([
			new StatsCounter('2026-11-19', 'trash_bytes', 5_000_000_000),
			new StatsCounter('2026-11-19', 'trash_files', 9),
			new StatsCounter('2026-11-20', 'trash_files', 1),
		], $this->stats->between('alice', null, null));
	}

	// spec: STATS-001.15
	public function testANegativeAddStopsAtZeroAndCreatesNoRow(): void {
		$this->stats->add('alice', '2026-11-19', StatsMetric::PicturesDecided, 2);
		$this->stats->add('alice', '2026-11-19', StatsMetric::PicturesDecided, -5);
		$this->stats->add('alice', '2026-11-19', StatsMetric::PicturesPicked, -1);

		$this->assertEquals([new StatsCounter('2026-11-19', 'pictures_decided', 0)], $this->stats->between('alice', null, null));

		$this->stats->add('alice', '2026-11-19', StatsMetric::PicturesDecided, 1);
		$this->assertEquals([new StatsCounter('2026-11-19', 'pictures_decided', 1)], $this->stats->between('alice', null, null));
	}

	public function testASecondInsertOfTheSameRowIsAUniqueConflict(): void {
		$this->insertRow('alice', '2026-11-19', 'series_done', 1);

		try {
			$this->insertRow('alice', '2026-11-19', 'series_done', 1);
			$this->fail('the unique index let a second row in');
		} catch (DbException $e) {
			$this->assertSame(DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION, $e->getReason());
		}
	}

	// spec: STATS-001.4, STATS-001.21
	public function testReadsTheDaysOfThePeriodOfOneUserBothEndsIncluded(): void {
		foreach (['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01'] as $day) {
			$this->stats->add('alice', $day, StatsMetric::SeriesDone, 1);
		}
		$this->stats->add('bob', '2026-11-15', StatsMetric::SeriesDone, 7);

		$days = array_map(static fn (StatsCounter $counter): string => $counter->day, $this->stats->between('alice', '2026-11-01', '2026-11-30'));

		$this->assertSame(['2026-11-01', '2026-11-30'], $days);
		$this->assertSame(['2026-10-31', '2026-11-01'], array_map(static fn (StatsCounter $counter): string => $counter->day, $this->stats->between('alice', null, '2026-11-01')));
		$this->assertSame(['2026-11-30', '2026-12-01'], array_map(static fn (StatsCounter $counter): string => $counter->day, $this->stats->between('alice', '2026-11-30', null)));
	}

	// spec: STATS-001.24
	public function testTheFirstDayIsTheUsersEarliestRow(): void {
		$this->assertNull($this->stats->firstDay('alice'));

		$this->stats->add('alice', '2026-12-12', StatsMetric::SeriesDone, 1);
		$this->stats->add('alice', '2026-12-31', StatsMetric::SeriesDone, 1);
		$this->stats->add('bob', '2026-01-01', StatsMetric::SeriesDone, 1);

		$this->assertSame('2026-12-12', $this->stats->firstDay('alice'));
	}

	// spec: STATS-001.3, STATS-001.28
	public function testForgetsEveryRowOfOneUser(): void {
		$this->stats->add('alice', '2026-11-19', StatsMetric::SeriesDone, 1);
		$this->stats->add('bob', '2026-11-19', StatsMetric::SeriesDone, 2);

		$this->stats->forgetUser('alice');

		$this->assertSame([], $this->stats->between('alice', null, null));
		$this->assertEquals([new StatsCounter('2026-11-19', 'series_done', 2)], $this->stats->between('bob', null, null));
	}

	// spec: STATS-001.6
	public function testARowHoldsUserDayMetricAndValueOnly(): void {
		$this->stats->add('alice', '2026-11-19', StatsMetric::TrashPictures, 3);

		$row = $this->db->getQueryBuilder()->select('*')->from('honeycomb_stats')->executeQuery()->fetch();

		$this->assertIsArray($row);
		$this->assertEqualsCanonicalizing(['id', 'user_id', 'day', 'metric', 'value'], array_keys($row));
	}

	private function insertRow(string $userId, string $day, string $metric, int $value): void {
		$query = $this->db->getQueryBuilder();
		$query->insert('honeycomb_stats')->values([
			'user_id' => $query->createNamedParameter($userId),
			'day' => $query->createNamedParameter($day),
			'metric' => $query->createNamedParameter($metric),
			'value' => $query->createNamedParameter($value),
		])->executeStatement();
	}
}
