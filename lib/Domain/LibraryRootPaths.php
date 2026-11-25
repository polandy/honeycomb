<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** Paths of library roots written as the client does (FOLDERS-004). */
final class LibraryRootPaths {
	/** The path with a leading `/` and no empty segment, so the home folder is `/`. */
	public static function normalize(string $path): string {
		return '/' . implode('/', array_filter(explode('/', trim($path)), static fn (string $segment): bool => trim($segment) !== ''));
	}

	/** Whether the path is a root or lies in one, never through a `.` or `..` step. */
	public static function isInside(string $path, string $root): bool {
		$normalized = self::normalize($path);
		return !array_intersect(explode('/', $normalized), ['.', '..']) && ($normalized === $root || str_starts_with($normalized, $root . '/'));
	}
}
