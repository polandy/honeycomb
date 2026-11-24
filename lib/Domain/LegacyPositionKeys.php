<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** Moves positions stored under an older folder set key to the current one (ADR 0034). */
final class LegacyPositionKeys {
	/**
	 * The positions to keep and the stored keys to forget or change; of two rows of one folder set, the newer stays.
	 * @param list<array{string, ResumePosition}> $rows each stored key and its position, the newest first
	 * @return array{keep: list<ResumePosition>, forget: list<string>, rekey: list<array{string, string}>}
	 */
	public static function repair(array $rows): array {
		$repair = ['keep' => [], 'forget' => [], 'rekey' => []];
		$kept = [];
		foreach ($rows as [$stored, $position]) {
			$key = $position->folderSet->key();
			if (isset($kept[$key])) {
				$repair['forget'][] = $stored;
				continue;
			}
			$kept[$key] = true;
			$repair['keep'][] = $position;
			if ($stored !== $key) {
				$repair['rekey'][] = [$stored, $key];
			}
		}
		return $repair;
	}
}
