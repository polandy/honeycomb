<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderDone;
use OCA\Honeycomb\Service\FolderDoneService;
use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\InvalidLibraryRequestException;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Marking a folder done and reopening it, with the counter (FOLDERS-006). */
final class FolderDoneServiceTest extends TestCase {
	use FakeFiles;
	use StatsFixture;

	private const int NOW = 1_772_407_800;

	private FakeFolderDoneStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeFolderDoneStore();
	}

	private function service(string $settings = ''): FolderDoneService {
		$root = $this->rootWith([
			'/Photos' => $this->folder('/Photos', fileId: 10),
			'/ReadOnly' => $this->folder('/ReadOnly', fileId: 11, permissions: Constants::PERMISSION_READ),
			'/NoCreate' => $this->folder('/NoCreate', fileId: 12, permissions: Constants::PERMISSION_ALL & ~Constants::PERMISSION_CREATE),
			'/Locked' => $this->folder('/Locked', readable: false, fileId: 13),
			'/Shared' => $this->folder('/Shared', mountType: 'shared', fileId: 14),
			'/a.jpg' => $this->file(15, '/a.jpg'),
		]);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		return new FolderDoneService(new UserPhotos(new UserFolderResolver($root)), $this->store, $time, $this->stats($settings));
	}

	// spec: FOLDERS-006.1
	public function testMarksARateableFolderDone(): void {
		$done = $this->service()->mark($this->user(), 10, 412);

		$this->assertEquals(new FolderDone(10, 'alice', self::NOW, 412), $done);
		$this->assertEquals([10 => $done], $this->store->rows);
	}

	// spec: FOLDERS-006.2
	public function testMarkingAgainReplacesTheStatusOfTheEarlierUser(): void {
		$this->store->rows[10] = new FolderDone(10, 'bob', 5, 400);

		$this->service()->mark($this->user(), 10, 412);

		$this->assertEquals([10 => new FolderDone(10, 'alice', self::NOW, 412)], $this->store->rows);
	}

	// spec: FOLDERS-006.3
	public function testReopeningTwiceRemovesTheStatusAndIsNoError(): void {
		$this->store->rows[10] = new FolderDone(10, 'bob', 5, 400);

		$this->service()->reopen($this->user(), 10);
		$this->service()->reopen($this->user(), 10);

		$this->assertSame([], $this->store->rows);
	}

	// spec: FOLDERS-006.4
	public function testAFolderThatIsNotRateableIsForbiddenForBothWrites(): void {
		foreach ([11, 12] as $fileId) {
			$this->store->rows[$fileId] = new FolderDone($fileId, 'bob', 5, 1);
		}
		foreach ([11, 12, 13] as $fileId) {
			foreach ([fn () => $this->service()->mark($this->user(), $fileId, 3), fn () => $this->service()->reopen($this->user(), $fileId)] as $write) {
				try {
					$write();
					$this->fail("Folder $fileId was written");
				} catch (FolderNotReadableException) {
					$this->addToAssertionCount(1);
				}
			}
		}

		$this->assertSame([11, 12], array_keys($this->store->rows));
		$this->assertSame([], $this->counted());
	}

	// spec: FOLDERS-006.5
	#[DataProvider('notOwnFolders')]
	public function testAnIdThatIsNoFolderOfTheOwnFilesIsNotFound(int $fileId): void {
		$this->store->rows[$fileId] = new FolderDone($fileId, 'bob', 5, 1);

		foreach ([fn () => $this->service()->mark($this->user(), $fileId, 3), fn () => $this->service()->reopen($this->user(), $fileId)] as $write) {
			try {
				$write();
				$this->fail("Id $fileId was written");
			} catch (FolderNotFoundException) {
				$this->addToAssertionCount(1);
			}
		}

		$this->assertSame([$fileId], array_keys($this->store->rows));
		$this->assertSame([], $this->counted());
	}

	/** @return array<string, array{int}> */
	public static function notOwnFolders(): array {
		return ['missing' => [99], 'file' => [15], 'share' => [14]];
	}

	// spec: FOLDERS-006.6
	#[DataProvider('malformedCounts')]
	public function testAMalformedCountIsABadRequestAndStoresNothing(mixed $photos): void {
		$this->expectException(InvalidLibraryRequestException::class);
		try {
			$this->service()->mark($this->user(), 10, $photos);
		} finally {
			$this->assertSame([], $this->store->rows);
			$this->assertSame([], $this->counted());
		}
	}

	/** @return array<string, array{mixed}> */
	public static function malformedCounts(): array {
		return ['missing' => [null], 'negative' => [-1], 'string' => ['12'], 'float' => [1.5], 'bool' => [true]];
	}

	// spec: FOLDERS-006.9
	public function testCountsEachMarkAndSubtractsNothingOnReopen(): void {
		$this->service()->mark($this->user(), 10, 1);
		$this->service()->mark($this->user(), 10, 2);
		$this->service()->reopen($this->user(), 10);

		$this->assertSame(['folders_done' => 2], $this->counted());
	}

	// spec: FOLDERS-006.10
	public function testCountsNothingWithStatisticsOff(): void {
		$this->service('{"keepStatistics":false}')->mark($this->user(), 10, 1);

		$this->assertCount(1, $this->store->rows);
		$this->assertSame([], $this->counted());
	}

	// spec: FOLDERS-006.11
	public function testAFailedCountDoesNotFailTheMark(): void {
		$this->failCounting();

		$this->service()->mark($this->user(), 10, 1);

		$this->assertCount(1, $this->store->rows);
		$this->assertNotSame([], $this->statsWarnings);
	}
}
