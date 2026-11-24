<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Service\OrphanedFlags;
use PHPUnit\Framework\TestCase;

final class OrphanedFlagsTest extends TestCase {
	private FakeFlagStore $store;
	private FakeExistingFiles $files;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeFlagStore();
		$this->files = new FakeExistingFiles();
	}

	/** @param list<int> $fileIds */
	private function flag(array $fileIds): void {
		foreach ($fileIds as $fileId) {
			$this->store->rows[$fileId] = new FileFlag($fileId, Flag::Picked, false, 100);
		}
	}

	// spec: DECISIONS-001.32
	public function testRemovesTheRowsOfFilesGoneOrInATrashBinOnce(): void {
		$this->flag([7, 8, 9]);
		$this->files->vanished = [7];
		$this->files->trashed = [8];
		$orphans = new OrphanedFlags($this->store, $this->files);

		$this->assertSame(2, $orphans->remove());
		$this->assertSame([9], array_keys($this->store->rows));
		$this->assertSame(0, $orphans->remove());
	}

	// spec: DECISIONS-001.32
	public function testWalksTheWholeTableInChunksOfAThousand(): void {
		$this->flag(range(1, 2_500));
		$this->files->trashed = [1, 1_500, 2_500];

		$this->assertSame(3, (new OrphanedFlags($this->store, $this->files))->remove());
		$this->assertSame([1_000, 1_000, 500], array_map(count(...), $this->files->calls));
		$this->assertCount(2_497, $this->store->rows);
	}
}
