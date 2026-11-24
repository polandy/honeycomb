<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\Store\ExistingFiles;

/** A file cache in memory: every file id exists except the vanished ones, and lies outside a trash bin except the trashed ones. */
final class FakeExistingFiles implements ExistingFiles {
	/** @var list<int> The file ids deleted for good. */
	public array $vanished = [];

	/** @var list<int> The file ids in a trash bin. */
	public array $trashed = [];

	/** @var list<list<int>> The file ids of each call. */
	public array $calls = [];

	/** @var bool Whether every call fails, as a lost database connection would. */
	public bool $fails = false;

	#[\Override]
	public function existing(array $fileIds): array {
		$this->calls[] = $fileIds;
		if ($this->fails) {
			throw new FakeDbException(0);
		}
		return array_values(array_diff($fileIds, $this->vanished));
	}

	#[\Override]
	public function outsideTrashBin(array $fileIds): array {
		$this->calls[] = $fileIds;
		if ($this->fails) {
			throw new FakeDbException(0);
		}
		return array_values(array_diff($fileIds, $this->vanished, $this->trashed));
	}
}
