<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidTagsException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\TagService;
use OCP\DB\Exception as DbException;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class TagServiceTest extends TestCase {
	private FakeTagStore $store;
	private TagService $service;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeTagStore();
		$this->service = new TagService($this->store);
	}

	private function user(string $uid): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	/**
	 * @param list<mixed> $tags
	 * @return array{fileId: int, tags: list<mixed>}
	 */
	private static function item(int $fileId, array $tags): array {
		return ['fileId' => $fileId, 'tags' => $tags];
	}

	// spec: TAGS-001.1, TAGS-001.2
	public function testStoresEachFilesTagsSortedAndAnswersInFileIdOrder(): void {
		$this->service->save($this->user('alice'), [self::item(2, ['Sunrise']), self::item(1, ['Places/Italy', 'People/Anna'])]);

		$this->assertEquals(
			[new PictureTags(1, ['People/Anna', 'Places/Italy']), new PictureTags(2, ['Sunrise'])],
			$this->service->lookup($this->user('alice'), [2, 1, 3]),
		);
	}

	// spec: TAGS-001.1
	public function testReturnsOnlyTheTagsOfTheAskedFileIds(): void {
		$this->service->save($this->user('alice'), [self::item(1, ['A']), self::item(2, ['B'])]);

		$this->assertEquals([new PictureTags(2, ['B'])], $this->service->lookup($this->user('alice'), [2]));
	}

	// spec: TAGS-001.2
	public function testOverwritesTheWholeEarlierList(): void {
		$this->service->save($this->user('alice'), [self::item(1, ['A', 'B'])]);

		$this->service->save($this->user('alice'), [self::item(1, ['C'])]);

		$this->assertEquals([new PictureTags(1, ['C'])], $this->service->lookup($this->user('alice'), [1]));
	}

	// spec: TAGS-001.3
	public function testRemovesTheRowOfAFileWithoutTags(): void {
		$this->service->save($this->user('alice'), [self::item(1, ['A']), self::item(2, ['A'])]);

		$this->service->save($this->user('alice'), [self::item(1, [])]);

		$this->assertEquals([new PictureTags(2, ['A'])], $this->service->lookup($this->user('alice'), [1, 2]));
		$this->assertArrayNotHasKey(1, $this->store->rows['alice']);
	}

	// spec: TAGS-001.4
	public function testKeepsTheTagsOfEachUserApart(): void {
		$this->service->save($this->user('alice'), [self::item(1, ['Anna'])]);
		$this->service->save($this->user('bob'), [self::item(1, ['Bert'])]);

		$this->assertEquals([new PictureTags(1, ['Anna'])], $this->service->lookup($this->user('alice'), [1]));
		$this->assertSame(['Bert'], $this->service->tagList($this->user('bob')));
	}

	// spec: TAGS-001.5
	public function testTheTagListKeepsEveryTagSavedSortedAndOnce(): void {
		$this->service->save($this->user('alice'), [self::item(1, ['Places/Italy', 'Anna']), self::item(2, ['Anna'])]);
		$this->service->save($this->user('alice'), [self::item(1, [])]);

		$this->assertSame(['Anna', 'Places/Italy'], $this->service->tagList($this->user('alice')));
	}

	// spec: TAGS-001.9
	public function testSavesAgainWhenAConcurrentSaveWonTheInsert(): void {
		$this->store->failures = 1;

		$this->service->save($this->user('alice'), [self::item(1, ['A'])]);

		$this->assertSame(2, $this->store->replaceCalls);
		$this->assertEquals([new PictureTags(1, ['A'])], $this->service->lookup($this->user('alice'), [1]));
	}

	// spec: TAGS-001.9
	public function testDoesNotRepeatAnotherDatabaseError(): void {
		$this->store->failures = 1;
		$this->store->failureReason = DbException::REASON_DEADLOCK;

		$thrown = null;
		try {
			$this->service->save($this->user('alice'), [self::item(1, ['A'])]);
		} catch (DbException $e) {
			$thrown = $e;
		}

		$this->assertInstanceOf(DbException::class, $thrown);
		$this->assertSame(1, $this->store->replaceCalls);
		$this->assertSame([], $this->service->lookup($this->user('alice'), [1]));
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedFileIds(): array {
		return [
			'not a list' => [['a' => 1]],
			'a text id' => [['1']],
			'a zero id' => [[0]],
			'over the limit' => [range(1, ListingService::ENTRY_LIMIT + 1)],
		];
	}

	// spec: TAGS-001.7
	#[DataProvider('malformedFileIds')]
	public function testRejectsMalformedFileIdsOnLookup(array $fileIds): void {
		$this->expectException(InvalidTagsException::class);

		$this->service->lookup($this->user('alice'), $fileIds);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedSaves(): array {
		return [
			'not a list' => [['a' => self::item(1, ['A'])]],
			'an item that is no object' => [['A']],
			'no file id' => [[['tags' => ['A']]]],
			'a zero file id' => [[self::item(0, ['A'])]],
			'no tags' => [[['fileId' => 1]]],
			'tags that are no list' => [[['fileId' => 1, 'tags' => ['x' => 'A']]]],
			'a tag that is no string' => [[self::item(1, [7])]],
			'an empty tag' => [[self::item(1, [''])]],
			'an empty name' => [[self::item(1, ['Places//Italy'])]],
			'a trailing slash' => [[self::item(1, ['Places/'])]],
			'a name with a space at its end' => [[self::item(1, ['Places /Italy'])]],
			'a name with a space at its start' => [[self::item(1, [' Places'])]],
			'a bar' => [[self::item(1, ['A|B'])]],
			'a tag over 255 characters' => [[self::item(1, [str_repeat('ä', PictureTags::MAX_LENGTH + 1)])]],
			'a tag twice' => [[self::item(1, ['A', 'A'])]],
			'more than 100 tags' => [[self::item(1, array_map(static fn (int $n): string => "T$n", range(0, PictureTags::MAX_TAGS)))]],
			'a file id twice' => [[self::item(1, ['A']), self::item(1, ['B'])]],
			'over the limit' => [array_fill(0, ListingService::ENTRY_LIMIT + 1, self::item(1, []))],
		];
	}

	// spec: TAGS-001.6
	#[DataProvider('malformedSaves')]
	public function testWritesNothingWhenOneItemIsMalformed(array $items): void {
		$this->service->save($this->user('alice'), [self::item(1, ['Kept'])]);

		$thrown = null;
		try {
			$this->service->save($this->user('alice'), [self::item(2, ['New']), ...$items]);
		} catch (InvalidTagsException $e) {
			$thrown = $e;
		}

		$this->assertInstanceOf(InvalidTagsException::class, $thrown);
		$this->assertEquals([new PictureTags(1, ['Kept'])], $this->service->lookup($this->user('alice'), [1, 2]));
		$this->assertSame(['Kept'], $this->service->tagList($this->user('alice')));
	}

	// spec: TAGS-001.6
	public function testAcceptsATagOfExactly255CharactersAndExactly100Tags(): void {
		$long = str_repeat('ä', PictureTags::MAX_LENGTH);
		$many = array_map(static fn (int $n): string => sprintf('T%03d', $n), range(1, PictureTags::MAX_TAGS));

		$this->service->save($this->user('alice'), [self::item(1, [$long]), self::item(2, $many)]);

		$this->assertEquals([new PictureTags(1, [$long]), new PictureTags(2, $many)], $this->service->lookup($this->user('alice'), [1, 2]));
	}
}
