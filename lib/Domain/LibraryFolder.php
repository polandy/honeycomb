<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** One folder of a library root, as the file cache has it; `path` is relative to the root, '' for the root itself. */
final readonly class LibraryFolder {
	public function __construct(
		public int $fileId,
		public string $path,
		public string $etag,
		public int $permissions,
	) {
	}
}
