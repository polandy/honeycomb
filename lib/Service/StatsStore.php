<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\DB\Exception as DbException;

/** The daily counters per user, day and metric; no file ids (ADR 0039). */
interface StatsStore extends UserRowStore {
	/**
	 * Adds `$amount` to the counter of the day, never below zero; a new row only for a positive amount.
	 * @throws DbException a unique conflict when a concurrent add created the row first
	 */
	public function add(string $userId, string $day, StatsMetric $metric, int $amount): void;

	/**
	 * The user's counters from `$from` to `$to`, both included and either open, by day and metric.
	 * @return list<StatsCounter>
	 */
	public function between(string $userId, ?string $from, ?string $to): array;

	/** The user's earliest counted day, null without one. */
	public function firstDay(string $userId): ?string;
}
