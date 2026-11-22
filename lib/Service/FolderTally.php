<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Sums up the photo files of one folder: pictures by the pairing rules, bytes, bursts and ages (FOLDERS-005.1 to .4). */
final class FolderTally {
	/** The longest gap between two shots of one burst: `BURST_GAP_SECONDS` in `src/logic/folder-score.ts`. */
	public const int BURST_GAP_SECONDS = 3;

	/**
	 * A picture's shot time is its earliest member's capture time; a burst is a shot at most the gap after the one before.
	 * @param list<array{name: string, size: int, mtime: int, captureTime: ?int}> $files
	 * @return array{photos: int, bytes: int, rawBytes: int, bursts: int, oldest: ?int, newest: ?int, lastActivity: ?int}
	 */
	public static function of(array $files, PairingExtensions $extensions): array {
		$pictures = PictureTally::pictures(array_column($files, 'name'), $extensions);
		$bytes = 0;
		$rawBytes = 0;
		$lastActivity = null;
		$shots = [];
		foreach ($pictures as $members) {
			$times = [];
			foreach ($members as $index) {
				$file = $files[$index];
				$bytes += $file['size'];
				if ($extensions->roleOf(pathinfo($file['name'], PATHINFO_EXTENSION)) === 'raw') {
					$rawBytes += $file['size'];
				}
				$lastActivity = max($lastActivity ?? $file['mtime'], $file['mtime']);
				if ($file['captureTime'] !== null) {
					$times[] = $file['captureTime'];
				}
			}
			if ($times !== []) {
				$shots[] = min($times);
			}
		}
		sort($shots);
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
		];
	}
}
