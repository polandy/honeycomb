<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Folder;

use OCA\Honeycomb\Domain\DoneSkip;
use OCA\Honeycomb\Domain\FolderDone;
use OCA\Honeycomb\Domain\FolderDoneBatch;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Reason;
use OCA\Honeycomb\Service\Files\FolderNotFoundException;
use OCA\Honeycomb\Service\Files\FolderNotReadableException;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Folder\FolderDoneService;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFolderDoneStore;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** *Mark all done* and *Reopen all* as one batch each (FOLDERS-006, ADR 0060). */
final class FolderDoneBatchTest extends TestCase {
	use FakeFiles;
	use StatsFixture;

	private const int NOW = 1_772_407_800;

	private FakeFolderDoneStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeFolderDoneStore();
	}

	private function service(): FolderDoneService {
		$root = $this->rootWith([
			'/A' => $this->folder('/A', fileId: 10),
			'/B' => $this->folder('/B', fileId: 11),
			'/ReadOnly' => $this->folder('/ReadOnly', fileId: 12, permissions: Constants::PERMISSION_READ),
			'/Bob' => $this->folder('/Bob', fileId: 13),
			'/Locked' => $this->folder('/Locked', readable: false, fileId: 14),
			'/Shared' => $this->folder('/Shared', mountType: 'shared', fileId: 15),
		]);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		return new FolderDoneService(new UserPhotos(new UserFolderResolver($root)), $this->store, $time, $this->stats());
	}

	// spec: FOLDERS-006.15, FOLDERS-009.17
	public function testMarksTheRateableFoldersAndSkipsTheReadOnlyAndTheDoneOnes(): void {
		$bob = new FolderDone(13, 'bob', 5, 400);
		$this->store->rows[13] = $bob;

		$batch = $this->service()->markAll($this->user(), [
			['fileId' => 10, 'photos' => 412], ['fileId' => 12, 'photos' => 3], ['fileId' => 13, 'photos' => 9], ['fileId' => 11, 'photos' => 0],
		]);

		$marked = [new FolderDone(10, 'alice', self::NOW, 412), new FolderDone(11, 'alice', self::NOW, 0)];
		$this->assertEquals(new FolderDoneBatch($marked, [12 => DoneSkip::ReadOnly, 13 => DoneSkip::Done]), $batch);
		$this->assertEquals([13 => $bob, 10 => $marked[0], 11 => $marked[1]], $this->store->rows);
		$this->assertSame(['folders_done' => 2], $this->counted());
	}

	// spec: FOLDERS-006.15
	public function testABatchWithNothingToMarkWritesAndCountsNothing(): void {
		$batch = $this->service()->markAll($this->user(), [['fileId' => 12, 'photos' => 3]]);

		$this->assertEquals(new FolderDoneBatch([], [12 => DoneSkip::ReadOnly]), $batch);
		$this->assertSame([], $this->store->rows);
		$this->assertSame([], $this->counted());
	}

	// spec: FOLDERS-006.16, FOLDERS-009.17
	#[DataProvider('malformedMarks')]
	public function testAMalformedMarkIsABadRequestWithItsReason(mixed $folders, Reason $reason): void {
		$this->assertRefused(fn () => $this->service()->markAll($this->user(), $folders), $reason);
	}

	/** @return array<string, array{mixed, Reason}> */
	public static function malformedMarks(): array {
		return [
			'no list' => [['fileId' => 10, 'photos' => 1], Reason::NotAList],
			'missing' => [null, Reason::NotAList],
			'item no object' => [[10], Reason::NotAnObject],
			'no photos' => [[['fileId' => 10]], Reason::BadValue],
			'negative photos' => [[['fileId' => 10, 'photos' => -1]], Reason::BadValue],
			'string photos' => [[['fileId' => 10, 'photos' => '1']], Reason::BadValue],
			'file id 0' => [[['fileId' => 0, 'photos' => 1]], Reason::BadFileId],
			'file id string' => [[['fileId' => '10', 'photos' => 1]], Reason::BadFileId],
			'twice' => [[['fileId' => 10, 'photos' => 1], ['fileId' => 10, 'photos' => 2]], Reason::Duplicate],
			'501' => [array_fill(0, 501, ['fileId' => 10, 'photos' => 1]), Reason::TooMany],
		];
	}

	// spec: FOLDERS-006.16
	#[DataProvider('malformedFileIds')]
	public function testAMalformedReopenIsABadRequestWithItsReason(mixed $fileIds, Reason $reason): void {
		$this->store->rows[10] = new FolderDone(10, 'bob', 5, 1);

		$this->assertRefused(fn () => $this->service()->reopenAll($this->user(), $fileIds), $reason);
	}

	/** @return array<string, array{mixed, Reason}> */
	public static function malformedFileIds(): array {
		return [
			'missing' => [null, Reason::NotAList],
			'object' => [['a' => 10], Reason::NotAList],
			'file id 0' => [[0], Reason::BadFileId],
			'twice' => [[10, 10], Reason::Duplicate],
			'501' => [range(1, 501), Reason::TooMany],
		];
	}

	// spec: FOLDERS-006.17
	#[DataProvider('failingMarks')]
	public function testOneFolderThatFailsTheCheckFailsTheWholeMark(int $fileId, string $exception): void {
		$this->expectException($exception);
		try {
			$this->service()->markAll($this->user(), [['fileId' => 10, 'photos' => 1], ['fileId' => $fileId, 'photos' => 1]]);
		} finally {
			$this->assertSame([], $this->store->rows);
			$this->assertSame([], $this->counted());
		}
	}

	/** @return array<string, array{int, class-string<\Throwable>}> */
	public static function failingMarks(): array {
		return ['missing' => [99, FolderNotFoundException::class], 'share' => [15, FolderNotFoundException::class], 'unreadable' => [14, FolderNotReadableException::class]];
	}

	// spec: FOLDERS-006.17
	public function testAReadOnlyFolderFailsTheWholeReopen(): void {
		$this->store->rows = [10 => new FolderDone(10, 'bob', 5, 1), 12 => new FolderDone(12, 'bob', 5, 1)];

		$this->expectException(FolderNotReadableException::class);
		try {
			$this->service()->reopenAll($this->user(), [10, 12]);
		} finally {
			$this->assertSame([10, 12], array_keys($this->store->rows));
		}
	}

	// spec: FOLDERS-006.18, FOLDERS-009.17
	public function testReopensEachFolderAlsoOneThatIsNotDone(): void {
		$this->store->rows = [10 => new FolderDone(10, 'bob', 5, 1), 13 => new FolderDone(13, 'bob', 5, 1)];

		$this->service()->reopenAll($this->user(), [10, 11, 13]);

		$this->assertSame([], $this->store->rows);
		$this->assertSame([], $this->counted());
	}

	private function assertRefused(callable $write, Reason $reason): void {
		try {
			$write();
			$this->fail('The write was not refused');
		} catch (InvalidRequestException $e) {
			$this->assertSame($reason, $e->reason);
		}
		$this->assertSame([], $this->counted());
	}
}
