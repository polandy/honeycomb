<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\PhotoCount;
use OCA\Honeycomb\Service\PhotoFilesBelow;
use OCP\Files\Folder;

/** Photo-file counts by absolute folder path, or a database that fails. */
final class FakePhotoFilesBelow implements PhotoFilesBelow {
	/**
	 * @param array<string, ?int> $counts
	 * @param list<string> $approximate absolute paths whose count may miss files
	 */
	public function __construct(
		private array $counts = [],
		private bool $fails = false,
		private array $approximate = [],
	) {
	}

	#[\Override]
	public function count(Folder $folder): ?PhotoCount {
		if ($this->fails) {
			throw new FakeDbException(\OCP\DB\Exception::REASON_CONNECTION_LOST);
		}
		$files = array_key_exists($folder->getPath(), $this->counts) ? $this->counts[$folder->getPath()] : 0;
		return $files === null ? null : new PhotoCount($files, in_array($folder->getPath(), $this->approximate, true));
	}
}
