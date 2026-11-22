<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Folds the decision rows of the files into the picked, rejected and done-but-unflagged pictures per folder (FOLDERS-001.9). */
final class FolderDecisions {
	/**
	 * The members of a picture share a folder and a base name; the latest flag wins, the first member on a tie,
	 * and the picture is in a done series when any member is.
	 * @param list<array{parent: int, name: string, flag: ?string, updatedAt: ?int, doneSeries: bool}> $rows
	 * @return array<int, array{picked: int, rejected: int, doneUnflagged: int}>
	 */
	public static function of(array $rows): array {
		$pictures = [];
		foreach ($rows as $row) {
			$base = strtolower(pathinfo($row['name'], PATHINFO_FILENAME));
			$picture = $pictures[$row['parent']][$base] ?? ['flag' => null, 'updatedAt' => null, 'doneSeries' => false];
			if ($row['flag'] !== null && ($picture['updatedAt'] === null || $row['updatedAt'] > $picture['updatedAt'])) {
				$picture['flag'] = $row['flag'];
				$picture['updatedAt'] = $row['updatedAt'];
			}
			$picture['doneSeries'] = $picture['doneSeries'] || $row['doneSeries'];
			$pictures[$row['parent']][$base] = $picture;
		}
		$counts = [];
		foreach ($pictures as $parent => $byBase) {
			$count = ['picked' => 0, 'rejected' => 0, 'doneUnflagged' => 0];
			foreach ($byBase as $picture) {
				$flag = Flag::tryFrom($picture['flag'] ?? '');
				match (true) {
					$flag === Flag::Picked => $count['picked']++,
					$flag === Flag::Rejected => $count['rejected']++,
					$picture['doneSeries'] => $count['doneUnflagged']++,
					default => null,
				};
			}
			$counts[$parent] = $count;
		}
		return $counts;
	}
}
