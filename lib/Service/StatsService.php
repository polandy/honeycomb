<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;
use Psr\Log\LoggerInterface;

/** Counts, reads and resets a user's statistics (STATS-001, ADR 0039). */
final readonly class StatsService {
	/** The settings field that turns counting off when it is `false`. */
	private const string SETTING = 'keepStatistics';

	public function __construct(
		private StatsStore $store,
		private StatsDay $day,
		private SettingsService $settings,
		private LoggerInterface $logger,
	) {
	}

	/** Adds the counts to the user's day while *Keep statistics* is on; a failure is logged, never thrown. */
	public function count(IUser $user, StatsCount ...$counts): void {
		try {
			if (!$this->keeps($user)) {
				return;
			}
			$day = $this->day->today($user);
			foreach ($counts as $count) {
				if ($count->amount !== 0) {
					RetryOnConflict::run(fn () => $this->store->add($user->getUID(), $day, $count->metric, $count->amount));
				}
			}
		} catch (\Exception $e) {
			$this->logger->warning('Could not count the statistics.', ['exception' => $e]);
		}
	}

	/**
	 * The user's counters of the days from `$from` to `$to`, both included, and their first counted day.
	 * @return array{counters: list<StatsCounter>, firstDay: ?string}
	 * @throws InvalidStatsRequestException for a malformed day or `$from` after `$to`
	 */
	public function read(IUser $user, ?string $from, ?string $to): array {
		$this->checkDay($from);
		$this->checkDay($to);
		if ($from !== null && $to !== null && $from > $to) {
			throw new InvalidStatsRequestException('from must not be after to');
		}
		return ['counters' => $this->store->between($user->getUID(), $from, $to), 'firstDay' => $this->store->firstDay($user->getUID())];
	}

	/** Removes every counter of the user. */
	public function reset(IUser $user): void {
		$this->store->forgetUser($user->getUID());
	}

	private function keeps(IUser $user): bool {
		$settings = $this->settings->get($user);
		return !property_exists($settings, self::SETTING) || $settings->{self::SETTING} !== false;
	}

	private function checkDay(?string $day): void {
		if ($day === null) {
			return;
		}
		$parsed = \DateTimeImmutable::createFromFormat('!' . StatsDay::FORMAT, $day);
		if ($parsed === false || $parsed->format(StatsDay::FORMAT) !== $day) {
			throw new InvalidStatsRequestException('a day must be YYYY-MM-DD');
		}
	}
}
