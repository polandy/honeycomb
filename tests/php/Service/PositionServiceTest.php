<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\InvalidPositionException;
use OCA\Honeycomb\Service\PositionService;
use OCA\Honeycomb\Service\ResumePosition;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PositionServiceTest extends TestCase {
	private const int NOW = 1_700_000_000;
	private const array HOLIDAY = ['paths' => ['/Photos/2024', '/Photos/2023'], 'subfolders' => true];

	private FakePositionStore $store;
	private int $now = self::NOW;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakePositionStore();
	}

	private function service(): PositionService {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->now);
		return new PositionService($this->store, $time);
	}

	private function user(string $uid): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	// spec: DECISIONS-002.1
	public function testStoresThePositionWithTheTimeOfSaving(): void {
		$saved = $this->service()->save($this->user('alice'), self::HOLIDAY, 12, 3, 10);

		$expected = new ResumePosition(new FolderSet(['/Photos/2023', '/Photos/2024'], true), 12, 3, 10, self::NOW);
		$this->assertEquals($expected, $saved);
		$this->assertEquals([$expected], $this->service()->recent($this->user('alice')));
	}

	// spec: DECISIONS-002.1
	public function testAnswersInTheShapeOfTheRequest(): void {
		$saved = $this->service()->save($this->user('alice'), self::HOLIDAY, 12, 3, 10);

		$this->assertSame(
			['folderSet' => ['paths' => ['/Photos/2023', '/Photos/2024'], 'subfolders' => true], 'fileId' => 12, 'decided' => 3, 'total' => 10, 'updatedAt' => self::NOW],
			json_decode(json_encode($saved, JSON_THROW_ON_ERROR), true),
		);
	}

	// spec: DECISIONS-002.2
	public function testTheSameFolderSetInAnotherOrderReplacesThePosition(): void {
		$this->service()->save($this->user('alice'), self::HOLIDAY, 12, 3, 10);
		$this->now++;

		$this->service()->save($this->user('alice'), ['paths' => ['/Photos/2023', '/Photos/2024', '/Photos/2023'], 'subfolders' => true], 14, 4, 10);

		$recent = $this->service()->recent($this->user('alice'));
		$this->assertCount(1, $recent);
		$this->assertSame(14, $recent[0]->fileId);
	}

	// spec: DECISIONS-002.2
	public function testWithoutSubfoldersIsAnotherFolderSet(): void {
		$this->service()->save($this->user('alice'), self::HOLIDAY, 12, 3, 10);

		$this->service()->save($this->user('alice'), ['subfolders' => false] + self::HOLIDAY, 12, 3, 10);

		$this->assertCount(2, $this->service()->recent($this->user('alice')));
	}

	// spec: DECISIONS-002.3
	public function testListsTheNewestFirstAndKeepsOnlyTheMostRecent(): void {
		for ($folder = 1; $folder <= PositionService::RECENT_LIMIT + 1; $folder++) {
			$this->service()->save($this->user('alice'), ['paths' => ["/Photos/$folder"], 'subfolders' => false], $folder, 0, 1);
			$this->now++;
		}

		$recent = $this->service()->recent($this->user('alice'));
		$this->assertCount(PositionService::RECENT_LIMIT, $recent);
		$this->assertSame(PositionService::RECENT_LIMIT + 1, $recent[0]->fileId);
		$this->assertSame(2, $recent[PositionService::RECENT_LIMIT - 1]->fileId);
	}

	// spec: DECISIONS-002.3
	public function testTheLatestSaveInTheSameSecondComesFirst(): void {
		$this->service()->save($this->user('alice'), self::HOLIDAY, 12, 3, 10);
		$this->service()->save($this->user('alice'), ['paths' => ['/Photos'], 'subfolders' => false], 13, 0, 5);
		$this->service()->save($this->user('alice'), self::HOLIDAY, 14, 4, 10);

		$this->assertSame([14, 13], array_map(static fn (ResumePosition $p): int => $p->fileId, $this->service()->recent($this->user('alice'))));
	}

	// spec: DECISIONS-002.4
	public function testKeepsThePositionsOfEachUserApart(): void {
		$this->service()->save($this->user('alice'), self::HOLIDAY, 12, 3, 10);

		$this->assertSame([], $this->service()->recent($this->user('bob')));
	}

	/** @return array<string, array{array<array-key, mixed>, int, int, int}> */
	public static function malformedPositions(): array {
		return [
			'no paths' => [['paths' => [], 'subfolders' => true], 12, 3, 10],
			'paths not a list' => [['paths' => ['a' => '/Photos'], 'subfolders' => true], 12, 3, 10],
			'a path not text' => [['paths' => [7], 'subfolders' => true], 12, 3, 10],
			'a path with ..' => [['paths' => ['/Photos/../secret'], 'subfolders' => true], 12, 3, 10],
			'a path with NUL' => [['paths' => ["/Photos\0"], 'subfolders' => true], 12, 3, 10],
			'too many paths' => [['paths' => array_map(static fn (int $i): string => "/$i", range(0, FolderSet::MAX_FOLDERS)), 'subfolders' => true], 12, 3, 10],
			'subfolders not a switch' => [['paths' => ['/Photos'], 'subfolders' => 1], 12, 3, 10],
			'missing subfolders' => [['paths' => ['/Photos']], 12, 3, 10],
			'file id zero' => [self::HOLIDAY, 0, 3, 10],
			'negative decided' => [self::HOLIDAY, 12, -1, 10],
			'more decided than total' => [self::HOLIDAY, 12, 11, 10],
		];
	}

	// spec: DECISIONS-002.5
	#[DataProvider('malformedPositions')]
	public function testRejectsAMalformedPosition(array $folderSet, int $fileId, int $decided, int $total): void {
		$this->expectException(InvalidPositionException::class);

		$this->service()->save($this->user('alice'), $folderSet, $fileId, $decided, $total);
	}

	// spec: DECISIONS-002.2
	public function testTheRootFolderIsAPath(): void {
		$saved = $this->service()->save($this->user('alice'), ['paths' => [''], 'subfolders' => true], 12, 0, 10);

		$this->assertSame([''], $saved->folderSet->paths);
	}

	public function testTheKeyIsTheClientsFolderSetKeyHashed(): void {
		$set = new FolderSet(['/Photos/2023', '/Fotos/ä'], true);

		$this->assertSame(hash('sha256', '[["/Fotos/ä","/Photos/2023"],true]'), $set->key());
	}
}
