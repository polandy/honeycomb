<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SettingsService;
use OCA\Honeycomb\Service\StatsDay;
use OCA\Honeycomb\Service\StatsService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\DB\Exception as DbException;
use Psr\Log\LoggerInterface;

/** A `StatsService` over an in-memory store, statistics on, at 1 March 2026, 23:30 UTC, for the tests of the services that count. */
trait StatsFixture {
	/** The moment every counting test runs at. */
	private static int $statsNow = 1_772_407_800;

	private ?FakeStatsStore $statsStore = null;

	/** @var list<string> the warnings the statistics logged */
	private array $statsWarnings = [];

	private function statsStore(): FakeStatsStore {
		return $this->statsStore ??= new FakeStatsStore();
	}

	/** @param string $settings the user's settings blob, none by default */
	private function stats(string $settings = ''): StatsService {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(static fn (string $user, string $app, string $key, string $default): string => $key === 'settings' && $settings !== '' ? $settings : $default);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getDateTime')->willReturnCallback(static fn (string $at = 'now', ?\DateTimeZone $zone = null): \DateTime => (new \DateTime('@' . self::$statsNow))->setTimezone($zone ?? new \DateTimeZone('UTC')));
		$logger = $this->createStub(LoggerInterface::class);
		$logger->method('warning')->willReturnCallback(function (string|\Stringable $message): void {
			$this->statsWarnings[] = (string)$message;
		});
		return new StatsService($this->statsStore(), new StatsDay($config, $time), new SettingsService($config), $logger);
	}

	/**
	 * Alice's counters of the day the tests run on, by metric key.
	 * @return array<string, int>
	 */
	private function counted(): array {
		return $this->statsStore()->rows['alice']['2026-03-01'] ?? [];
	}

	/** Makes every counter write fail. */
	private function failCounting(): void {
		$this->statsStore()->failures = array_fill(0, 20, new FakeDbException(DbException::REASON_CONNECTION_LOST));
	}
}
