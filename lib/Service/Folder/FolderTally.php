<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Folder;

use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Domain\PictureTally;

/** Sums up the photo files of one folder: pictures by the pairing rules, bytes, bursts and ages (FOLDERS-005.1 to .4). */
final class FolderTally {
	/** The longest gap between two shots of one burst: `BURST_GAP_SECONDS` in `src/logic/folder-score.ts`. */
	public const int BURST_GAP_SECONDS = 3;

	/** The day format of a shot day, the counters' format (ADR 0039). */
	private const string DAY_FORMAT = 'Y-m-d';
	private const string DEFAULT_ZONE = 'UTC';

	/**
	 * A picture's shot time is its earliest member's capture time, its shot day that else its earliest modification time in `$zone` (ADR 0062); a burst is a shot at most the gap after the one before.
	 * @param list<array{fileId?: int, name: string, size: int, mtime: int, captureTime: ?int}> $files
	 * @return array{photos: int, bytes: int, rawBytes: int, bursts: int, oldest: ?int, newest: ?int, lastActivity: ?int, shotDays: array<string, int>}
	 */
	public static function of(array $files, PairingExtensions $extensions, ?\DateTimeZone $zone = null): array {
		$pictures = PictureTally::pictures(array_column($files, 'name'), $extensions);
		$bytes = 0;
		$rawBytes = 0;
		$lastActivity = null;
		$shots = [];
		$shotDays = [];
		foreach ($pictures as $members) {
			$times = [];
			$earliestMtime = PHP_INT_MAX;
			foreach ($members as $index) {
				$file = $files[$index];
				$bytes += $file['size'];
				if ($extensions->roleOf(pathinfo($file['name'], PATHINFO_EXTENSION)) === 'raw') {
					$rawBytes += $file['size'];
				}
				$lastActivity = max($lastActivity ?? $file['mtime'], $file['mtime']);
				$earliestMtime = min($earliestMtime, $file['mtime']);
				if ($file['captureTime'] !== null) {
					$times[] = $file['captureTime'];
				}
			}
			if ($times !== []) {
				$shots[] = min($times);
			}
			$day = self::day($times === [] ? $earliestMtime : min($times), $zone ?? new \DateTimeZone(self::DEFAULT_ZONE));
			$shotDays[$day] = ($shotDays[$day] ?? 0) + 1;
		}
		sort($shots);
		ksort($shotDays);
		$bursts = 0;
		for ($index = 1; $index < count($shots); $index++) {
			$bursts += $shots[$index] - $shots[$index - 1] <= self::BURST_GAP_SECONDS ? 1 : 0;
		}
		return [
			'photos' => count($pictures),
			'bytes' => $bytes,
			'rawBytes' => $rawBytes,
			'bursts' => $bursts,
			'oldest' => $shots === [] ? null : $shots[0],
			'newest' => $shots === [] ? null : $shots[count($shots) - 1],
			'lastActivity' => $lastActivity,
			'shotDays' => $shotDays,
		];
	}

	private static function day(int $time, \DateTimeZone $zone): string {
		return (new \DateTimeImmutable('@' . $time))->setTimezone($zone)->format(self::DAY_FORMAT);
	}
}
