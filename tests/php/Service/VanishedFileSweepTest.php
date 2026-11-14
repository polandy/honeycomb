<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\VanishedFileSweep;
use OCP\DB\Exception as DbException;
use PHPUnit\Framework\TestCase;

final class VanishedFileSweepTest extends TestCase {
	use AppConfigStub;

	private const string KEY = 'vanished_after_test';
	private const int CHUNK = 1_000;
	private const int CHUNKS_PER_RUN = 100;

	private FakeExistingFiles $files;
	private VanishedFileSweep $sweep;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeExistingFiles();
		$this->sweep = new VanishedFileSweep($this->files, $this->appConfigStub());
	}

	private function cursor(): int {
		return $this->appConfig[self::KEY] ?? -1;
	}

	// spec: DECISIONS-001.16
	public function testAnEmptyTableIsReadOnceAndRemovesNothing(): void {
		$table = new FakeRowTable();

		$this->assertSame(0, $this->sweep->sweep(self::KEY, $table));

		$this->assertSame([0], $table->reads);
		$this->assertSame([], $this->files->calls);
		$this->assertSame(0, $this->cursor());
	}

	// spec: DECISIONS-001.16
	public function testExactlyOneFullChunkEndsThePassAtTheEmptyNextRead(): void {
		$table = FakeRowTable::ofRows(self::CHUNK);
		$this->files->vanished = [1, 500, self::CHUNK];

		$this->assertSame(3, $this->sweep->sweep(self::KEY, $table));

		$this->assertSame([0, self::CHUNK], $table->reads);
		$this->assertCount(self::CHUNK - 3, $table->rows);
		$this->assertArrayNotHasKey(500, $table->rows);
		$this->assertSame(0, $this->cursor());
	}

	// spec: DECISIONS-001.16
	public function testTheRowAfterAFullChunkIsReadAfterItsLastRowId(): void {
		$table = FakeRowTable::ofRows(self::CHUNK + 1);
		$this->files->vanished = [self::CHUNK + 1];

		$this->assertSame(1, $this->sweep->sweep(self::KEY, $table));

		$this->assertSame([0, self::CHUNK], $table->reads);
		$this->assertCount(self::CHUNK, $table->rows);
		$this->assertSame(0, $this->cursor());
	}

	// spec: DECISIONS-001.16
	public function testATableOfOnlyVanishedFilesIsEmptiedInOnePass(): void {
		$table = FakeRowTable::ofRows(self::CHUNK + 1);
		$this->files->vanished = range(1, self::CHUNK + 1);

		$this->assertSame(self::CHUNK + 1, $this->sweep->sweep(self::KEY, $table));

		$this->assertSame([0, self::CHUNK], $table->reads);
		$this->assertSame([], $table->rows);
	}

	// spec: DECISIONS-001.16
	public function testAsksTheFileCacheOncePerChunkWithEachFileIdOnce(): void {
		$table = FakeRowTable::withRows([3 => 7, 4 => 8, 9 => 7]);
		$this->files->vanished = [7];

		$this->assertSame(2, $this->sweep->sweep(self::KEY, $table));

		$this->assertSame([[7, 8]], $this->files->calls);
		$this->assertSame([4 => 8], $table->rows);
	}

	// spec: DECISIONS-001.17
	public function testALongTableIsCleanedOverSeveralRunsAndStartsAgain(): void {
		$rowsPerRun = self::CHUNK * self::CHUNKS_PER_RUN;
		$table = FakeRowTable::ofRows($rowsPerRun + 1);
		$this->files->vanished = [$rowsPerRun, $rowsPerRun + 1];

		$this->assertSame(1, $this->sweep->sweep(self::KEY, $table));
		$this->assertCount(self::CHUNKS_PER_RUN, $table->takeReads());
		$this->assertSame($rowsPerRun, $this->cursor());

		$this->assertSame(1, $this->sweep->sweep(self::KEY, $table));
		$this->assertSame([$rowsPerRun], $table->takeReads());
		$this->assertSame(0, $this->cursor());

		$this->sweep->sweep(self::KEY, $table);
		$this->assertSame(0, $table->takeReads()[0]);
	}

	// spec: DECISIONS-001.17
	public function testGoesOnAfterTheStoredRowId(): void {
		$table = FakeRowTable::ofRows(10);
		$this->appConfig[self::KEY] = 5;
		$this->files->vanished = [2, 8];

		$this->assertSame(1, $this->sweep->sweep(self::KEY, $table));

		$this->assertSame([5], $table->reads);
		$this->assertArrayHasKey(2, $table->rows);
	}

	// spec: DECISIONS-001.18
	public function testAFailedReadKeepsTheLastFinishedChunk(): void {
		$table = FakeRowTable::ofRows(self::CHUNK + 1);
		$table->readsBeforeFailure = 1;
		$this->files->vanished = [1, self::CHUNK + 1];

		$this->expectException(DbException::class);
		try {
			$this->sweep->sweep(self::KEY, $table);
		} finally {
			$this->assertArrayNotHasKey(1, $table->rows);
			$this->assertArrayHasKey(self::CHUNK + 1, $table->rows);
			$this->assertSame(self::CHUNK, $this->cursor());
		}
	}

	// spec: DECISIONS-001.18
	public function testAFailedFileCacheLookupRemovesNothingAndKeepsTheCursor(): void {
		$table = FakeRowTable::ofRows(3);
		$this->appConfig[self::KEY] = 1;
		$this->files->fails = true;

		$this->expectException(DbException::class);
		try {
			$this->sweep->sweep(self::KEY, $table);
		} finally {
			$this->assertCount(3, $table->rows);
			$this->assertSame(1, $this->cursor());
		}
	}
}
