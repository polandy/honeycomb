<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\DB\Exception as DbException;
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
		$this->add($user, static fn (): array => $counts);
	}

	/**
	 * Counts the sidecars a save created, those it replaced that were last changed before the user's day, the foreign ones among those, and the counts the saved items carried (ADR 0039).
	 * @param list<array{mtime: ?int, foreign: bool}> $saved each saved sidecar's modification time before the save, null for a created one, and whether it held data of another program
	 */
	public function countSidecars(IUser $user, array $saved, StatsCount ...$counts): void {
		$this->add($user, function () use ($user, $saved, $counts): array {
			$start = $this->day->start($user);
			$updated = array_filter($saved, static fn (array $sidecar): bool => $sidecar['mtime'] !== null && $sidecar['mtime'] < $start);
			return [
				new StatsCount(StatsMetric::SidecarsCreated, count(array_filter($saved, static fn (array $sidecar): bool => $sidecar['mtime'] === null))),
				new StatsCount(StatsMetric::SidecarsUpdated, count($updated)),
				new StatsCount(StatsMetric::SidecarsForeign, count(array_filter($updated, static fn (array $sidecar): bool => $sidecar['foreign']))),
				...$counts,
			];
		});
	}

	/** Counts the active time a position save carried, at most the time since `$since`, or since the start of the user's day without one (STATS-001.16). */
	public function countActiveSeconds(IUser $user, int $seconds, int $now, ?int $since): void {
		$this->add($user, fn (): array => [new StatsCount(StatsMetric::ActiveSeconds, max(0, min($seconds, $now - ($since ?? $this->day->start($user)))))]);
	}

	/** @param \Closure(): array<StatsCount> $counts */
	private function add(IUser $user, \Closure $counts): void {
		try {
			if (!$this->keeps($user)) {
				return;
			}
			$day = $this->day->today($user);
			foreach (self::summed($counts()) as $metric => $amount) {
				if ($amount !== 0) {
					RetryOnConflict::run(fn () => $this->store->add($user->getUID(), $day, StatsMetric::from($metric), $amount));
				}
			}
		} catch (DbException $e) {
			// Statistics are best effort; the caller's action must not fail for them.
			$this->logger->warning('Could not count the statistics.', ['exception' => $e]);
		}
	}

	/**
	 * One sum per metric, in the order the metrics first come.
	 * @param array<StatsCount> $counts
	 * @return array<string, int>
	 */
	private static function summed(array $counts): array {
		$sums = [];
		foreach ($counts as $count) {
			$sums[$count->metric->value] = ($sums[$count->metric->value] ?? 0) + $count->amount;
		}
		return $sums;
	}

	/**
	 * The user's counters of the days from `$from` to `$to`, both included, their first counted day and their today.
	 * @return array{counters: list<StatsCounter>, firstDay: ?string, today: string}
	 * @throws InvalidStatsRequestException for a malformed day or `$from` after `$to`
	 */
	public function read(IUser $user, ?string $from, ?string $to): array {
		$this->checkDay($from);
		$this->checkDay($to);
		if ($from !== null && $to !== null && $from > $to) {
			throw new InvalidStatsRequestException('from must not be after to');
		}
		return ['counters' => $this->store->between($user->getUID(), $from, $to), 'firstDay' => $this->store->firstDay($user->getUID()), 'today' => $this->day->today($user)];
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
