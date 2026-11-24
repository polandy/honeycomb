<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Folder;

use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Domain\PictureTally;

/** Picks the few pictures of a folder that stand for it on the *Folders* screen (FOLDERS-005.18). */
final class FolderPreviews {
	/** How many pictures stand for a folder. */
	public const int COUNT = 3;

	/**
	 * The rendered files of up to `COUNT` pictures, spread over the folder's capture time order (names for pictures without one, last).
	 * @param list<array{fileId: int, name: string, mtime: int, captureTime: ?int}> $files
	 * @return list<array{fileId: int, mtime: int}>
	 */
	public static function pick(array $files, PairingExtensions $extensions): array {
		$candidates = [];
		foreach (PictureTally::pictures(array_column($files, 'name'), $extensions) as $members) {
			$shown = array_values(array_filter($members, static fn (int $index): bool => $extensions->roleOf(pathinfo($files[$index]['name'], PATHINFO_EXTENSION)) === 'rendered'));
			if ($shown === []) {
				continue;
			}
			$times = array_filter(array_map(static fn (int $index): ?int => $files[$index]['captureTime'], $members), static fn (?int $time): bool => $time !== null);
			$candidates[] = ['file' => $files[$shown[0]], 'time' => $times === [] ? PHP_INT_MAX : min($times)];
		}
		usort($candidates, static fn (array $a, array $b): int => [$a['time'], $a['file']['name']] <=> [$b['time'], $b['file']['name']]);
		$count = min(self::COUNT, count($candidates));
		$picked = [];
		for ($place = 0; $place < $count; $place++) {
			$file = $candidates[$count === 1 ? 0 : intdiv($place * (count($candidates) - 1), $count - 1)]['file'];
			$picked[] = ['fileId' => $file['fileId'], 'mtime' => $file['mtime']];
		}
		return $picked;
	}
}
