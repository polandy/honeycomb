<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\PhotoFilesBelow;
use OCP\Files\Folder;

/** Photo-file counts by absolute folder path, or a database that fails. */
final class FakePhotoFilesBelow implements PhotoFilesBelow {
	/** @param array<string, ?int> $counts */
	public function __construct(
		private array $counts = [],
		private bool $fails = false,
	) {
	}

	#[\Override]
	public function count(Folder $folder): ?int {
		if ($this->fails) {
			throw new FakeDbException('database gone');
		}
		return array_key_exists($folder->getPath(), $this->counts) ? $this->counts[$folder->getPath()] : 0;
	}
}
