<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\LocalFiles;

/** Local files in memory; a path not in `$files` is missing, and every read is recorded. */
final class FakeLocalFiles implements LocalFiles {
	/** @var array<string, string> */
	public array $files = [];
	/** @var list<string> */
	public array $reads = [];

	#[\Override]
	public function read(string $path): ?string {
		$this->reads[] = $path;
		return $this->files[$path] ?? null;
	}
}
