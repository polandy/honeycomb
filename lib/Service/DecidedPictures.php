<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Counts each user's pictures with a pick or a reject, the start value of the statistics (ADR 0039). */
final class DecidedPictures {
	/** The preference that keeps a user's start value, as `{"count": n, "day": "YYYY-MM-DD"}`. */
	public const string KEY = 'pictures_decided_before';

	/**
	 * The number of decided pictures per user; the members of a picture share its folder and base name.
	 * @param iterable<array{userId: string, flag: string, parent: ?int, name: ?string}> $rows
	 * @return array<array-key, int> a numeric user id comes back as an int key
	 */
	public static function count(iterable $rows): array {
		$pictures = [];
		$withoutFile = [];
		foreach ($rows as $row) {
			if ($row['flag'] === Flag::Unflagged->value) {
				continue;
			}
			if ($row['parent'] === null || $row['name'] === null) {
				$withoutFile[$row['userId']] = ($withoutFile[$row['userId']] ?? 0) + 1;
				continue;
			}
			$pictures[$row['userId']][$row['parent'] . '/' . mb_strtolower(pathinfo($row['name'], PATHINFO_FILENAME))] = true;
		}
		$counts = [];
		foreach (array_unique(array_merge(array_keys($pictures), array_keys($withoutFile))) as $userId) {
			$counts[$userId] = count($pictures[$userId] ?? []) + ($withoutFile[$userId] ?? 0);
		}
		return $counts;
	}
}
