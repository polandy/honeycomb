<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\PictureCount;
use OCA\Honeycomb\Service\PicturesBelow;
use OCP\Files\Folder;

/** Picture counts by absolute folder path, or a database that fails. */
final class FakePicturesBelow implements PicturesBelow {
	/**
	 * @param array<string, ?int> $counts
	 * @param list<string> $approximate absolute paths whose count may miss files
	 * @param array<string, int> $orphans orphaned sidecars by absolute folder path
	 */
	public function __construct(
		private array $counts = [],
		private bool $fails = false,
		private array $approximate = [],
		private array $orphans = [],
	) {
	}

	#[\Override]
	public function count(Folder $folder): ?PictureCount {
		if ($this->fails) {
			throw new FakeDbException(\OCP\DB\Exception::REASON_CONNECTION_LOST);
		}
		$files = array_key_exists($folder->getPath(), $this->counts) ? $this->counts[$folder->getPath()] : 0;
		return $files === null ? null : new PictureCount($files, $this->orphans[$folder->getPath()] ?? 0, in_array($folder->getPath(), $this->approximate, true));
	}
}
