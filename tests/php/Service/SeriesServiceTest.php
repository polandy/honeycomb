<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidSeriesException;
use OCA\Honeycomb\Service\SeriesService;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\StoredSeries;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\DB\Exception as DbException;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use PHPUnit\Framework\TestCase;

final class SeriesServiceTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	/** The file ids `alice` reaches as photos; 50 is a text file. */
	private const array PHOTOS = [3, 4, 5, 7, 8, 9];

	private FakeSeriesStore $store;
	private SeriesService $service;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeSeriesStore();
		$userFolder = $this->folder('');
		$find = fn (int $id): ?Node => match (true) {
			in_array($id, self::PHOTOS, true) => $this->file($id, "/P/IMG_$id.JPG"),
			$id === 50 => $this->file($id, '/P/notes.txt', 'text/plain'),
			default => null,
		};
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($find));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$this->service = new SeriesService($this->store, new UserPhotos(new UserFolderResolver($root)));
	}

	/** @return array<string, mixed> */
	private static function item(?int $id, string $status, int ...$fileIds): array {
		return ['id' => $id, 'status' => $status, 'fileIds' => $fileIds];
	}

	// spec: SERIES-005.20
	public function testAnswersTheStoredSeriesAndKeptOutFilesAmongTheFileIds(): void {
		$id = $this->store->add('alice', SeriesStatus::Done, 7, 8, 30);
		$this->store->rows['alice'][9] = null;
		$this->store->add('bob', SeriesStatus::Open, 3);
		$lookup = $this->service->lookup($this->user(), [3, 7, 8, 9]);
		$this->assertEquals([new StoredSeries($id, SeriesStatus::Done, [7, 8], true)], $lookup->series);
		$this->assertSame([9], $lookup->keptOut);
	}

	// spec: SERIES-005.20
	public function testRefusesAMalformedLookup(): void {
		$this->expectException(InvalidSeriesException::class);
		$this->service->lookup($this->user(), ['7']);
	}

	// spec: SERIES-005.21, SERIES-005.22
	public function testWritesTheSeriesAndAnswersTheirIdsAndTheSavedFileIds(): void {
		$id = $this->store->add('alice', SeriesStatus::Open, 7, 8);
		$answer = $this->service->save($this->user(), [self::item($id, 'done', 7), self::item(null, 'open', 3, 4)], [8], [5]);
		$this->assertSame(['ids' => [$id, $id + 1], 'saved' => [7, 3, 4, 8, 5]], $answer);
		$this->assertSame([7 => $id, 8 => null, 3 => $id + 1, 4 => $id + 1], $this->store->rows['alice']);
		$this->assertSame(SeriesStatus::Done, $this->store->series[$id]['status']);
	}

	// spec: SERIES-005.24
	public function testSkipsTheFilesThatAreNotTheUsersPhotos(): void {
		$answer = $this->service->save($this->user(), [self::item(null, 'open', 7, 50, 404)], [8, 405], [51]);
		$this->assertSame(['ids' => [1], 'saved' => [7, 8]], $answer);
		$this->assertSame([7 => 1, 8 => null], $this->store->rows['alice']);
	}

	// spec: SERIES-005.23
	public function testWritesNothingForAMalformedBody(): void {
		try {
			$this->service->save($this->user(), [self::item(null, 'closed', 7)], [], []);
			$this->fail('A malformed body was written');
		} catch (InvalidSeriesException) {
			$this->assertSame(0, $this->store->writeCalls);
		}
	}

	public function testWritesAgainAfterAConcurrentSaveWonTheInsert(): void {
		$this->store->failures = 1;
		$this->assertSame(['ids' => [1], 'saved' => [7]], $this->service->save($this->user(), [self::item(null, 'open', 7)], [], []));
		$this->assertSame(2, $this->store->writeCalls);
	}

	public function testAnotherDatabaseErrorReachesTheCaller(): void {
		$this->store->failures = 1;
		$this->store->failureReason = 0;
		$this->expectException(DbException::class);
		$this->service->save($this->user(), [self::item(null, 'open', 7)], [], []);
	}
}
