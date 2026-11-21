<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Counts the pictures and orphaned sidecars among the file names of one folder (LISTING-003, pairing as LISTING-002). */
final class PictureTally {
	/** The default RAW extensions of the pairing settings, lower case. */
	private const array RAW_EXTENSIONS = ['nef', 'cr2', 'cr3', 'arw', 'raf', 'orf', 'rw2', 'dng', 'pef', 'srw'];

	/** The default rendered extensions of the pairing settings, lower case. */
	private const array RENDERED_EXTENSIONS = ['jpg', 'jpeg', 'heic', 'heif', 'hif'];

	/**
	 * A RAW and a rendered file of one base name are one picture, any other photo file is one by itself.
	 * @param list<string> $photos
	 * @param list<string> $videos
	 * @param list<string> $sidecars
	 * @return array{pictures: int, orphans: int}
	 */
	public static function of(array $photos, array $videos, array $sidecars): array {
		$byBase = [];
		foreach ($photos as $name) {
			$byBase[strtolower(pathinfo($name, PATHINFO_FILENAME))][] = strtolower(pathinfo($name, PATHINFO_EXTENSION));
		}
		$pictures = 0;
		foreach ($byBase as $extensions) {
			$raws = count(array_intersect($extensions, self::RAW_EXTENSIONS));
			$rendered = count(array_intersect($extensions, self::RENDERED_EXTENSIONS));
			$pictures += count($extensions) - ($raws === 1 && $rendered === 1 ? 1 : 0);
		}
		return ['pictures' => $pictures, 'orphans' => count(OrphanedSidecarRule::orphanNames([...$photos, ...$videos], $sidecars))];
	}
}
