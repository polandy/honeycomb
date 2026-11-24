<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Service\StatsCount;
use OCA\Honeycomb\Service\StatsItemCounts;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class StatsItemCountsTest extends TestCase {
	private const array TAKES = [StatsMetric::RatingsSet, StatsMetric::TagsSet];

	// spec: STATS-001.36
	public function testNoCountsAreNone(): void {
		$this->assertSame([], StatsItemCounts::parse(null, self::TAKES));
	}

	// spec: STATS-001.16
	public function testEachValueIsCappedAtPlusOrMinusOne(): void {
		$counts = StatsItemCounts::parse(['ratings_set' => 7, 'tags_set' => -4], self::TAKES);

		$this->assertEquals([new StatsCount(StatsMetric::RatingsSet, 1), new StatsCount(StatsMetric::TagsSet, -1)], $counts);
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		return [
			'a list' => [[1]],
			'a text' => ['ratings_set'],
			'an unknown metric' => [['frames_set' => 1]],
			'a metric the endpoint does not take' => [['pictures_decided' => 1]],
			'a value that is no integer' => [['ratings_set' => '1']],
		];
	}

	// spec: STATS-001.16
	#[DataProvider('malformed')]
	public function testMalformedCountsAreRejected(mixed $counts): void {
		$this->expectException(InvalidRequestException::class);

		StatsItemCounts::parse($counts, self::TAKES);
	}
}
