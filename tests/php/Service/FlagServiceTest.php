<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FlagService;
use OCA\Honeycomb\Service\InvalidFlagException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use OCP\DB\Exception as DbException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class FlagServiceTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	private const int NOW = 1_800_000_000;
	/** A file id every user reaches, but as a text file. */
	private const int TEXT_FILE = 50;
	private const int RATEABLE = Constants::PERMISSION_READ | Constants::PERMISSION_UPDATE | Constants::PERMISSION_CREATE;

	private FakeFlagStore $store;
	/** @var int How often a photo's folder was read. */
	private int $folderReads = 0;
	/** @var list<list<int>> The file ids of each search. */
	private array $searched = [];

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeFlagStore();
	}

	/** @param array<int, array{string, int}> $photos folder path and its permissions, by photo id */
	private function service(array $photos): FlagService {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		return new FlagService($this->store, $this->userPhotos($photos), $time);
	}

	/** @param array<int, array{string, int}> $photos */
	private function userPhotos(array $photos): UserPhotos {
		$folders = [];
		foreach (array_unique(array_column($photos, 0)) as $path) {
			$permissions = array_values(array_filter($photos, static fn (array $photo): bool => $photo[0] === $path))[0][1];
			$folders[$path] = $this->folder($path, permissions: $permissions);
		}
		$byId = function (int $id) use ($photos, $folders): ?Node {
			if ($id === self::TEXT_FILE) {
				return $this->file($id, '/Photos/notes.txt', 'text/plain');
			}
			if (!isset($photos[$id])) {
				return null;
			}
			$path = $photos[$id][0];
			$file = $this->createStub(File::class);
			$file->method('getId')->willReturn($id);
			$file->method('getName')->willReturn("IMG_$id.JPG");
			$file->method('getMimetype')->willReturn('image/jpeg');
			$file->method('getPath')->willReturn(self::USER_ROOT . "$path/IMG_$id.JPG");
			$file->method('getParent')->willReturnCallback(function () use ($folders, $path): Folder {
				++$this->folderReads;
				return $folders[$path];
			});
			return $file;
		};
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($byId, $this->searched));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		return new UserPhotos(new UserFolderResolver($root));
	}

	private function userNamed(string $uid): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	private static function item(int $fileId, string $flag = 'picked', bool $keepRaw = false): array {
		return ['fileId' => $fileId, 'flag' => $flag, 'keepRaw' => $keepRaw];
	}

	// spec: DECISIONS-001.23
	public function testASaveReplacesTheWholeStateAndKeepsADefaultRow(): void {
		$this->store->rows[7] = new FileFlag(7, Flag::Rejected, true, 100);
		$service = $this->service([7 => ['/Photos', self::RATEABLE], 8 => ['/Photos', self::RATEABLE]]);

		$answer = $service->save($this->user(), [self::item(7, 'unflagged'), self::item(8, 'picked', true)]);

		$this->assertEquals([7 => new FileFlag(7, Flag::Unflagged, false, self::NOW), 8 => new FileFlag(8, Flag::Picked, true, self::NOW)], $this->store->rows);
		$this->assertSame(['saved' => [7, 8], 'skipped' => []], $answer->jsonSerialize());
	}

	// spec: DECISIONS-001.22
	public function testEveryUserSavesTheOneStateOfAFile(): void {
		$service = $this->service([7 => ['/Shared', self::RATEABLE]]);

		$service->save($this->userNamed('alice'), [self::item(7, 'picked')]);
		$service->save($this->userNamed('bob'), [self::item(7, 'rejected', true)]);

		$this->assertEquals([7 => new FileFlag(7, Flag::Rejected, true, self::NOW)], $this->store->rows);
	}

	// spec: DECISIONS-001.24
	public function testASaveSkipsWhatTheUserDoesNotReachOrMayNotSet(): void {
		$this->store->rows[9] = new FileFlag(9, Flag::Picked, false, 100);
		$service = $this->service([
			7 => ['/Photos', self::RATEABLE],
			9 => ['/Shared', Constants::PERMISSION_READ],
			10 => ['/NoCreate', Constants::PERMISSION_READ | Constants::PERMISSION_UPDATE],
		]);

		$answer = $service->save($this->user(), [self::item(7), self::item(8), self::item(9, 'rejected'), self::item(10), self::item(self::TEXT_FILE)]);

		$this->assertEqualsCanonicalizing([7, 9], array_keys($this->store->rows));
		$this->assertEquals(new FileFlag(9, Flag::Picked, false, 100), $this->store->rows[9]);
		$this->assertSame(['saved' => [7], 'skipped' => [
			['fileId' => 8, 'reason' => 'notFound'],
			['fileId' => 9, 'reason' => 'notPermitted'],
			['fileId' => 10, 'reason' => 'notPermitted'],
			['fileId' => self::TEXT_FILE, 'reason' => 'notFound'],
		]], $answer->jsonSerialize());
	}

	// spec: DECISIONS-001.24
	public function testASubfolderWithoutRightsIsNotPermittedUnderARateableParent(): void {
		$service = $this->service([7 => ['/Photos', self::RATEABLE], 8 => ['/Photos/Locked', Constants::PERMISSION_READ]]);

		$answer = $service->save($this->user(), [self::item(7), self::item(8)]);

		$this->assertSame(['saved' => [7], 'skipped' => [['fileId' => 8, 'reason' => 'notPermitted']]], $answer->jsonSerialize());
	}

	public function testASaveOfNothingTheUserMaySetWritesNothing(): void {
		$answer = $this->service([])->save($this->user(), [self::item(8)]);

		$this->assertSame(0, $this->store->writeCalls);
		$this->assertSame(['saved' => [], 'skipped' => [['fileId' => 8, 'reason' => 'notFound']]], $answer->jsonSerialize());
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformed(): array {
		return [
			'not a list' => [['a' => self::item(7)]],
			'not an object' => [[7]],
			'no file id' => [[['flag' => 'picked', 'keepRaw' => false]]],
			'file id zero' => [[self::item(0)]],
			'file id as text' => [[['fileId' => '7', 'flag' => 'picked', 'keepRaw' => false]]],
			'unknown flag' => [[self::item(7, 'maybe')]],
			'keepRaw as number' => [[['fileId' => 7, 'flag' => 'picked', 'keepRaw' => 1]]],
			'a file id twice' => [[self::item(7), self::item(7, 'rejected')]],
			'too many' => [array_map(static fn (int $id): array => self::item($id), range(1, ListingService::ENTRY_LIMIT + 1))],
		];
	}

	// spec: DECISIONS-001.25
	#[DataProvider('malformed')]
	public function testAMalformedSaveWritesNothing(array $items): void {
		$service = $this->service([7 => ['/Photos', self::RATEABLE]]);
		try {
			$service->save($this->user(), $items);
			$this->fail('Expected InvalidFlagException');
		} catch (InvalidFlagException) {
			$this->assertSame(0, $this->store->writeCalls);
		}
	}

	// spec: DECISIONS-001.25
	#[DataProvider('malformed')]
	public function testAMalformedTakeOverWritesNothing(array $items): void {
		$service = $this->service([7 => ['/Photos', self::RATEABLE]]);
		try {
			$service->takeOver($this->user(), $items);
			$this->fail('Expected InvalidFlagException');
		} catch (InvalidFlagException) {
			$this->assertSame(0, $this->store->writeCalls);
		}
	}

	// spec: DECISIONS-001.27
	public function testATakeOverInsertsOnlyWhereNoRowIsAndAReaderMayTakeOver(): void {
		$this->store->rows[7] = new FileFlag(7, Flag::Rejected, false, 100);
		$service = $this->service([7 => ['/Shared', Constants::PERMISSION_READ], 8 => ['/Shared', Constants::PERMISSION_READ]]);

		$answer = $service->takeOver($this->user(), [self::item(7, 'picked', true), self::item(8, 'unflagged'), self::item(9)]);

		$this->assertEquals([7 => new FileFlag(7, Flag::Rejected, false, 100), 8 => new FileFlag(8, Flag::Unflagged, false, self::NOW)], $this->store->rows);
		$this->assertSame(['saved' => [8], 'skipped' => [
			['fileId' => 7, 'reason' => 'exists'],
			['fileId' => 9, 'reason' => 'notFound'],
		]], $answer->jsonSerialize());
	}

	// spec: DECISIONS-001.29
	public function testASaveReadsTheRightsOncePerFolder(): void {
		$photos = [];
		foreach (range(1, 2_000) as $id) {
			$photos[$id] = match ($id % 3) {
				0 => ['/A', self::RATEABLE],
				1 => ['/B', self::RATEABLE],
				default => ['/C', Constants::PERMISSION_READ],
			};
		}
		$items = array_map(static fn (int $id): array => self::item($id), array_keys($photos));

		$answer = $this->service($photos)->save($this->user(), $items);

		$this->assertSame(3, $this->folderReads);
		$this->assertSame([1_000, 1_000], array_map(count(...), $this->searched));
		$alone = [];
		foreach ($items as $item) {
			$this->store = new FakeFlagStore();
			array_push($alone, ...$this->service($photos)->save($this->user(), [$item])->jsonSerialize()['saved']);
		}
		$this->assertSame($alone, $answer->jsonSerialize()['saved']);
	}

	/** @return array<string, array{int}> */
	public static function repeatedReasons(): array {
		return [
			'unique key' => [DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION],
			'deadlock' => [DbException::REASON_DEADLOCK],
			'lock wait timeout' => [DbException::REASON_LOCK_WAIT_TIMEOUT],
		];
	}

	// spec: DECISIONS-001.30
	#[DataProvider('repeatedReasons')]
	public function testASaveThatLosesARaceIsRepeated(int $reason): void {
		$this->store->failures = 2;
		$this->store->failureReason = $reason;

		$this->service([7 => ['/Photos', self::RATEABLE]])->save($this->user(), [self::item(7)]);

		$this->assertSame(3, $this->store->writeCalls);
		$this->assertEquals([7 => new FileFlag(7, Flag::Picked, false, self::NOW)], $this->store->rows);
	}

	// spec: DECISIONS-001.30
	public function testASaveFailingOnEveryAttemptOrOnAnotherErrorStoresNothing(): void {
		$this->store->failures = 3;
		try {
			$this->service([7 => ['/Photos', self::RATEABLE]])->save($this->user(), [self::item(7)]);
			$this->fail('Expected the database error');
		} catch (DbException) {
			$this->assertSame(3, $this->store->writeCalls);
			$this->assertSame([], $this->store->rows);
		}
	}

	// spec: DECISIONS-001.30
	public function testATakeOverThatLosesTheRaceLeavesTheOtherRow(): void {
		$this->store->failures = 1;
		$this->store->insertedMeanwhile = new FileFlag(7, Flag::Rejected, true, 200);

		$answer = $this->service([7 => ['/Photos', self::RATEABLE]])->takeOver($this->user(), [self::item(7)]);

		$this->assertSame(2, $this->store->writeCalls);
		$this->assertEquals([7 => new FileFlag(7, Flag::Rejected, true, 200)], $this->store->rows);
		$this->assertSame(['saved' => [], 'skipped' => [['fileId' => 7, 'reason' => 'exists']]], $answer->jsonSerialize());
	}
}
