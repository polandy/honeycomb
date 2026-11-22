<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Counts the pictures and orphaned sidecars among the file names of one folder (LISTING-003, pairing as LISTING-002). */
final class PictureTally {
	/**
	 * A photo in neither pairing list is no picture, but still owns its sidecars.
	 * @param list<string> $photos
	 * @param list<string> $videos
	 * @param list<string> $sidecars
	 * @return array{pictures: int, orphans: int}
	 */
	public static function of(array $photos, array $videos, array $sidecars, PairingExtensions $extensions): array {
		return ['pictures' => count(self::pictures($photos, $extensions)), 'orphans' => count(OrphanedSidecarRule::orphanNames([...$photos, ...$videos], $sidecars))];
	}

	/**
	 * The pictures among the photo names, each as the keys of its members: a RAW and a rendered file of one
	 * base name are one picture, any other photo file with a listed extension is one by itself.
	 * @template K of array-key
	 * @param array<K, string> $names
	 * @return list<list<K>>
	 */
	public static function pictures(array $names, PairingExtensions $extensions): array {
		$byBase = [];
		foreach ($names as $key => $name) {
			$role = $extensions->roleOf(pathinfo($name, PATHINFO_EXTENSION));
			if ($role !== null) {
				$byBase[strtolower(pathinfo($name, PATHINFO_FILENAME))][$role][] = $key;
			}
		}
		$pictures = [];
		foreach ($byBase as $roles) {
			$raws = $roles['raw'] ?? [];
			$rendered = $roles['rendered'] ?? [];
			if (count($raws) === 1 && count($rendered) === 1) {
				$pictures[] = [$rendered[0], $raws[0]];
				continue;
			}
			foreach ([...$rendered, ...$raws] as $key) {
				$pictures[] = [$key];
			}
		}
		return $pictures;
	}
}
