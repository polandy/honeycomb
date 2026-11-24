<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Service\InvalidStatsRequestException;
use OCA\Honeycomb\Service\SettingsService;
use OCA\Honeycomb\Service\StatsCount;
use OCA\Honeycomb\Service\StatsCounter;
use OCA\Honeycomb\Service\StatsDay;
use OCA\Honeycomb\Service\StatsMetric;
use OCA\Honeycomb\Service\StatsService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\DB\Exception as DbException;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class StatsServiceTest extends TestCase {
	/** 1 March 2026, 23:30 UTC: 2 March, 00:30 in Berlin. */
	private const int LATE_ON_1_MARCH = 1_772_407_800;

	private FakeStatsStore $store;
	/** @var array<string, array<string, array<string, string>>> by user, app and key */
	private array $config = [];
	/** @var list<string> */
	private array $warnings = [];

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeStatsStore();
	}

	private function service(): StatsService {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(fn (string $userId, string $app, string $key, string $default = ''): string => $this->config[$userId][$app][$key] ?? $default);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getDateTime')->willReturnCallback(static fn (string $at = 'now', ?\DateTimeZone $zone = null): \DateTime => (new \DateTime('@' . self::LATE_ON_1_MARCH))->setTimezone($zone ?? new \DateTimeZone('UTC')));
		$logger = $this->createStub(LoggerInterface::class);
		$logger->method('warning')->willReturnCallback(function (string|\Stringable $message): void {
			$this->warnings[] = (string)$message;
		});
		return new StatsService($this->store, new StatsDay($config, $time), new SettingsService($config), $logger);
	}

	private function user(string $uid = 'alice'): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	private function settings(string $json): void {
		$this->config['alice'][Application::APP_ID]['settings'] = $json;
	}

	// spec: STATS-001.2
	public function testCountsWhenTheSettingWasNeverChanged(): void {
		$this->service()->count($this->user(), new StatsCount(StatsMetric::TrashPictures, 3), new StatsCount(StatsMetric::TrashFiles, 9));

		$this->assertSame(['2026-03-01' => ['trash_pictures' => 3, 'trash_files' => 9]], $this->store->rows['alice']);
	}

	/** @return array<string, array{string}> */
	public static function onSettings(): array {
		return ['true' => ['{"keepStatistics":true}'], 'not a boolean' => ['{"keepStatistics":"no"}'], 'null' => ['{"keepStatistics":null}']];
	}

	// spec: STATS-001.2
	#[DataProvider('onSettings')]
	public function testOnlyFalseTurnsCountingOff(string $settings): void {
		$this->settings($settings);

		$this->service()->count($this->user(), new StatsCount(StatsMetric::SeriesDone, 1));

		$this->assertSame(['2026-03-01' => ['series_done' => 1]], $this->store->rows['alice']);
	}

	// spec: STATS-001.1
	public function testCountsNothingWithKeepStatisticsOffAndKeepsWhatIsThere(): void {
		$this->store->rows['alice']['2026-02-27'] = ['series_done' => 2];
		$this->settings('{"keepStatistics":false}');

		$this->service()->count($this->user(), new StatsCount(StatsMetric::SeriesDone, 1));

		$this->assertSame(['2026-02-27' => ['series_done' => 2]], $this->store->rows['alice']);
		$this->assertEquals(['counters' => [new StatsCounter('2026-02-27', 'series_done', 2)], 'firstDay' => '2026-02-27', 'today' => '2026-03-01'], $this->service()->read($this->user(), null, null));
	}

	// spec: STATS-001.18
	public function testCountsOnTheDayOfTheUsersTimeZone(): void {
		$this->config['alice']['core']['timezone'] = 'Europe/Berlin';

		$this->service()->count($this->user(), new StatsCount(StatsMetric::PicturesMoved, 1));

		$this->assertSame(['2026-03-02' => ['pictures_moved' => 1]], $this->store->rows['alice']);
	}

	// spec: STATS-001.18
	public function testCountsOnTheUtcDayWithAnUnknownTimeZone(): void {
		$this->config['alice']['core']['timezone'] = 'Mars/Olympus';

		$this->service()->count($this->user(), new StatsCount(StatsMetric::PicturesMoved, 1));

		$this->assertSame(['2026-03-01' => ['pictures_moved' => 1]], $this->store->rows['alice']);
		$this->assertSame([], $this->warnings);
	}

	public function testSkipsAZeroCount(): void {
		$this->service()->count($this->user(), new StatsCount(StatsMetric::TrashBytes, 0));

		$this->assertArrayNotHasKey('alice', $this->store->rows);
	}

	public function testRepeatsAnAddThatLostTheRaceForANewRow(): void {
		$this->store->failures = [new FakeDbException(DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION)];

		$this->service()->count($this->user(), new StatsCount(StatsMetric::SidecarsCreated, 2));

		$this->assertSame(['2026-03-01' => ['sidecars_created' => 2]], $this->store->rows['alice']);
		$this->assertSame([], $this->warnings);
	}

	// spec: STATS-001.7
	public function testAFailedWriteIsLoggedAndNeverThrown(): void {
		$this->store->failures = [new FakeDbException(DbException::REASON_CONNECTION_LOST)];

		$this->service()->count($this->user(), new StatsCount(StatsMetric::TrashPictures, 1), new StatsCount(StatsMetric::TrashFiles, 2));

		$this->assertSame(['Could not count the statistics.'], $this->warnings);
	}

	// spec: STATS-001.7
	public function testUnreadableSettingsAreLoggedAndNeverThrown(): void {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willThrowException(new FakeDbException(DbException::REASON_CONNECTION_LOST));
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with('Could not count the statistics.', $this->arrayHasKey('exception'));
		$service = new StatsService($this->store, new StatsDay($config, $this->createStub(ITimeFactory::class)), new SettingsService($config), $logger);

		$service->count($this->user(), new StatsCount(StatsMetric::TrashPictures, 1));

		$this->assertSame([], $this->store->rows);
	}

	// spec: STATS-001.4, STATS-001.21
	public function testReadsTheUsersOwnCountersOfThePeriodTheirFirstDayAndToday(): void {
		$this->store->rows['alice'] = ['2026-02-01' => ['series_done' => 1], '2026-02-10' => ['trash_files' => 4, 'series_done' => 2], '2026-03-01' => ['series_done' => 5]];
		$this->store->rows['bob'] = ['2026-01-01' => ['series_done' => 9], '2026-02-10' => ['series_done' => 9]];

		$read = $this->service()->read($this->user(), '2026-02-10', '2026-02-28');

		$this->assertEquals(['counters' => [new StatsCounter('2026-02-10', 'series_done', 2), new StatsCounter('2026-02-10', 'trash_files', 4)], 'firstDay' => '2026-02-01', 'today' => '2026-03-01'], $read);
	}

	// spec: STATS-001.23
	public function testReadsNothingForAUserWithoutCounters(): void {
		$this->assertSame(['counters' => [], 'firstDay' => null, 'today' => '2026-03-01'], $this->service()->read($this->user(), null, '2026-03-01'));
	}

	/** @return array<string, array{?string, ?string}> */
	public static function invalidPeriods(): array {
		return [
			'not a day' => ['yesterday', null],
			'no zero padding' => ['2026-3-1', null],
			'no such day' => [null, '2026-02-30'],
			'trailing text' => ['2026-02-01x', null],
			'from after to' => ['2026-02-02', '2026-02-01'],
		];
	}

	#[DataProvider('invalidPeriods')]
	public function testRejectsAMalformedPeriod(?string $from, ?string $to): void {
		$this->expectException(InvalidStatsRequestException::class);

		$this->service()->read($this->user(), $from, $to);
	}

	// spec: STATS-001.3
	public function testResetRemovesEveryCounterOfTheUserOnly(): void {
		$this->store->rows['alice'] = ['2026-02-01' => ['series_done' => 1], '2026-02-10' => ['trash_files' => 4]];
		$this->store->rows['bob'] = ['2026-02-10' => ['series_done' => 9]];

		$this->service()->reset($this->user());

		$this->assertSame(['counters' => [], 'firstDay' => null, 'today' => '2026-03-01'], $this->service()->read($this->user(), null, null));
		$this->assertSame(['2026-02-10' => ['series_done' => 9]], $this->store->rows['bob']);
	}

	public function testAnUnexpectedFailureIsNotCaught(): void {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willThrowException(new \LogicException('bug'));
		$service = new StatsService($this->store, new StatsDay($config, $this->createStub(ITimeFactory::class)), new SettingsService($config), $this->createStub(LoggerInterface::class));
		$this->expectException(\LogicException::class);

		$service->count($this->user(), new StatsCount(StatsMetric::TrashPictures, 1));
	}
}
