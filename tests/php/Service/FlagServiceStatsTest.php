<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FlagService;
use OCA\Honeycomb\Service\InvalidRequestException;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

/** What a flag save counts from the counts its items carry (STATS-001). */
final class FlagServiceStatsTest extends TestCase {
	use FakeUserPhotos;
	use StatsFixture;

	private function service(): FlagService {
		return new FlagService(new FakeFlagStore(), $this->userPhotos(7, 8), $this->createStub(ITimeFactory::class), $this->stats());
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	/** @param array<string, int> $counts */
	private static function item(int $fileId, array $counts = []): array {
		return ['fileId' => $fileId, 'flag' => 'picked', 'keepRaw' => false] + ($counts === [] ? [] : ['counts' => $counts]);
	}

	// spec: STATS-001.14
	public function testAddsTheCountsOfTheSavedItemsInOneSumPerMetric(): void {
		$this->service()->save($this->user(), [
			self::item(7, ['pictures_decided' => 1, 'pictures_picked' => 1]),
			self::item(8, ['pictures_decided' => 1, 'pictures_rejected' => 1, 'pictures_picked' => -1]),
		]);

		$this->assertSame(['pictures_decided' => 2, 'pictures_rejected' => 1], $this->counted());
	}

	// spec: STATS-001.36
	public function testASkippedItemCountsNothing(): void {
		$this->service()->save($this->user(), [self::item(7, ['pictures_decided' => 1]), self::item(9, ['pictures_rejected' => 1])]);

		$this->assertSame(['pictures_decided' => 1], $this->counted());
	}

	// spec: STATS-001.16
	public function testAValueBeyondOneIsCappedAtOne(): void {
		$this->service()->save($this->user(), [self::item(7, ['pictures_decided' => 50, 'pictures_picked' => 3])]);

		$this->assertSame(['pictures_decided' => 1, 'pictures_picked' => 1], $this->counted());
	}

	// spec: STATS-001.16
	public function testAMetricAFlagSaveDoesNotCarryIsRejectedBeforeAnyWrite(): void {
		$this->expectException(InvalidRequestException::class);

		$this->service()->save($this->user(), [self::item(7, ['trash_bytes' => 1])]);
	}

	// spec: STATS-001.7
	public function testAFailedCountLeavesTheSaveAsItIs(): void {
		$this->failCounting();

		$answer = $this->service()->save($this->user(), [self::item(7, ['pictures_decided' => 1])]);

		$this->assertSame(['saved' => [7], 'skipped' => []], $answer->jsonSerialize());
		$this->assertSame(['Could not count the statistics.'], $this->statsWarnings);
	}

	// spec: STATS-001.36
	public function testATakeOverCountsNothing(): void {
		$this->service()->takeOver($this->user(), [self::item(7, ['pictures_decided' => 1])]);

		$this->assertSame([], $this->counted());
	}
}
