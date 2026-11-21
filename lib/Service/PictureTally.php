<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Counts the pictures and orphaned sidecars among the file names of one folder (LISTING-003, pairing as LISTING-002). */
final class PictureTally {
	/**
	 * A RAW and a rendered file of one base name are one picture, any other photo file with a listed
	 * extension is one by itself; a photo in neither list is none, but still owns its sidecars.
	 * @param list<string> $photos
	 * @param list<string> $videos
	 * @param list<string> $sidecars
	 * @return array{pictures: int, orphans: int}
	 */
	public static function of(array $photos, array $videos, array $sidecars, PairingExtensions $extensions): array {
		$byBase = [];
		foreach ($photos as $name) {
			$role = $extensions->roleOf(pathinfo($name, PATHINFO_EXTENSION));
			if ($role !== null) {
				$byBase[strtolower(pathinfo($name, PATHINFO_FILENAME))][] = $role;
			}
		}
		$pictures = 0;
		foreach ($byBase as $roles) {
			$raws = count(array_keys($roles, 'raw', true));
			$pictures += count($roles) - ($raws === 1 && count($roles) === 2 ? 1 : 0);
		}
		return ['pictures' => $pictures, 'orphans' => count(OrphanedSidecarRule::orphanNames([...$photos, ...$videos], $sidecars))];
	}
}
