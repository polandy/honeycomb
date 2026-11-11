<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Preview;

/** RAW files that Nextcloud types `application/octet-stream`, recognised by their extension. */
final class UntypedRaw {
	/** Canon and Samsung RAW, missing from Nextcloud's mime type mapping. */
	public const array EXTENSIONS = ['cr3', 'srw'];

	/** Whether a file of this name is such a RAW file. */
	public static function isNamed(string $name): bool {
		return in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), self::EXTENSIONS, true);
	}
}
