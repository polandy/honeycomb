<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Reads local files with PHP's file functions. */
final class PhpLocalFiles implements LocalFiles {
	#[\Override]
	public function read(string $path): ?string {
		/** @psalm-suppress ForbiddenCode The connections and key files live outside Nextcloud's storage (ADR 0042). */
		if (!is_file($path) || !is_readable($path)) {
			return null;
		}
		/** @psalm-suppress ForbiddenCode The connections and key files live outside Nextcloud's storage (ADR 0042). */
		$content = @file_get_contents($path);
		return $content === false ? null : $content;
	}
}
