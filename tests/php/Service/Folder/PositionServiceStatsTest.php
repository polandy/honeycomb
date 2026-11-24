<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Folder;

use OCA\Honeycomb\Domain\FolderSet;
use OCA\Honeycomb\Domain\ResumePosition;
use OCA\Honeycomb\Service\Folder\PositionService;
use OCA\Honeycomb\Tests\Service\FakePositionStore;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

/** What a position save counts from the active time it carries (STATS-001). */
final class PositionServiceStatsTest extends TestCase {
	use StatsFixture;

	private const int START_OF_DAY = 1_772_323_200;
	private const array HOLIDAY = ['paths' => ['/Photos/2024'], 'subfolders' => false];

	private FakePositionStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakePositionStore();
	}

	private function service(): PositionService {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::$statsNow);
		return new PositionService($this->store, $time, $this->stats());
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	private function savedBefore(int $seconds, array $folderSet = self::HOLIDAY): void {
		$this->store->save('alice', new ResumePosition(FolderSet::fromRequest($folderSet), 3, 1, 10, self::$statsNow - $seconds));
	}

	// spec: STATS-001.39
	public function testCountsTheActiveTimeTheSaveCarries(): void {
		$this->savedBefore(600);

		$this->service()->save($this->user(), self::HOLIDAY, 12, 3, 10, 90);

		$this->assertSame(['active_seconds' => 90], $this->counted());
	}

	// spec: STATS-001.16
	public function testActiveTimeIsCappedAtTheTimeSinceTheFolderSetWasLastSaved(): void {
		$this->savedBefore(60);
		$this->savedBefore(10, ['paths' => ['/Photos/2023'], 'subfolders' => false]);

		$this->service()->save($this->user(), self::HOLIDAY, 12, 3, 10, 5000);

		$this->assertSame(['active_seconds' => 60], $this->counted());
	}

	// spec: STATS-001.16
	public function testWithoutAnEarlierSaveActiveTimeIsCappedAtTheStartOfTheDay(): void {
		$this->service()->save($this->user(), self::HOLIDAY, 12, 3, 10, 1_000_000);

		$this->assertSame(['active_seconds' => self::$statsNow - self::START_OF_DAY], $this->counted());
	}

	// spec: STATS-001.16
	public function testNegativeActiveTimeCountsNothing(): void {
		$this->service()->save($this->user(), self::HOLIDAY, 12, 3, 10, -30);

		$this->assertSame([], $this->counted());
	}

	// spec: STATS-001.7
	public function testAFailedCountStillSavesThePosition(): void {
		$this->failCounting();

		$saved = $this->service()->save($this->user(), self::HOLIDAY, 12, 3, 10, 90);

		$this->assertEquals([$saved], $this->service()->recent($this->user()));
		$this->assertSame(['Could not count the statistics.'], $this->statsWarnings);
	}
}
