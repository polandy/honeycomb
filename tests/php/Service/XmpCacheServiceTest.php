<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidXmpCacheException;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpCacheService;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use PHPUnit\Framework\TestCase;

final class XmpCacheServiceTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	private FakeXmpCacheStore $store;

	private FakeTagStore $tags;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeXmpCacheStore();
		$this->tags = new FakeTagStore();
	}

	/** A service whose user folder reaches a sidecar 9, a JPEG 7, a RAW 8 and a folder 5. */
	private function service(): XmpCacheService {
		$folder = $this->folder('/P/Sub');
		$folder->method('getId')->willReturn(5);
		$byId = [
			9 => $this->file(9, '/P/A.XMP', 'application/octet-stream'),
			7 => $this->file(7, '/P/A.JPG'),
			8 => $this->file(8, '/P/A.CR3', 'image/x-dcraw'),
			5 => $folder,
		];
		$userFolder = $this->folder('');
		$find = static fn (int $id): ?Node => $byId[$id] ?? null;
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($find));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new XmpCacheService($this->store, $this->tags, new UserPhotos(new UserFolderResolver($root)));
	}

	private static function row(array $changes = []): XmpCacheRow {
		return XmpCacheRow::fromRequest(XmpCacheRowTest::item($changes));
	}

	// spec: XMP-006.1
	public function testLooksUpTheStoredRowsOnly(): void {
		$this->store->rows['alice'] = [9 => self::row(), 7 => self::row(['fileId' => 7, 'kind' => 'embedded'])];
		$this->store->rows['bob'] = [3 => self::row(['fileId' => 3])];

		$found = $this->service()->lookup($this->user(), [9, 7, 3]);

		$this->assertEquals([self::row(), self::row(['fileId' => 7, 'kind' => 'embedded'])], $found);
	}

	// spec: XMP-006.4
	public function testRefusesALookupOfMoreThanTheLimit(): void {
		$this->expectException(InvalidXmpCacheException::class);
		$this->service()->lookup($this->user(), range(1, XmpCacheService::LIMIT + 1));
	}

	// spec: XMP-006.4
	public function testRefusesAMalformedLookup(): void {
		$this->expectException(InvalidXmpCacheException::class);
		$this->service()->lookup($this->user(), ['9']);
	}

	// spec: XMP-006.2
	public function testASaveReplacesTheWholeRow(): void {
		$this->store->rows['alice'] = [9 => self::row()];
		$new = XmpCacheRowTest::item(['etag' => 'etag-new', 'rating' => null, 'tags' => null]);

		$saved = $this->service()->save($this->user(), [$new]);

		$this->assertSame([9], $saved);
		$this->assertEquals([9 => XmpCacheRow::fromRequest($new)], $this->store->rows['alice']);
	}

	// spec: XMP-006.9
	public function testASaveAddsTheTagsOfTheReachedRowsToTheTagList(): void {
		$this->tags->tagLists['alice'] = ['Trip'];

		$this->service()->save($this->user(), [
			XmpCacheRowTest::item(['tags' => ['Places/Rome', 'Trip']]),
			XmpCacheRowTest::item(['fileId' => 404, 'tags' => ['Hidden']]),
			XmpCacheRowTest::item(['fileId' => 7, 'kind' => 'embedded', 'tags' => null]),
		]);

		$this->assertSame(['Places/Rome', 'Trip'], $this->tags->tagList('alice'));
	}

	// spec: XMP-006.3
	public function testSkipsWhatTheUserDoesNotReachAsThatKind(): void {
		$skipped = $this->service()->save($this->user(), [
			XmpCacheRowTest::item(['fileId' => 404]),
			XmpCacheRowTest::item(['fileId' => 7]),
			XmpCacheRowTest::item(['fileId' => 8, 'kind' => 'embedded']),
			XmpCacheRowTest::item(['fileId' => 5]),
		]);
		$saved = $this->service()->save($this->user(), [XmpCacheRowTest::item(['fileId' => 7, 'kind' => 'embedded']), XmpCacheRowTest::item()]);

		$this->assertSame([], $skipped);
		$this->assertSame([7, 9], $saved);
		$this->assertSame([7, 9], array_keys($this->store->rows['alice']));
	}

	// spec: XMP-006.4
	public function testOneMalformedRowWritesNothing(): void {
		try {
			$this->service()->save($this->user(), [XmpCacheRowTest::item(), XmpCacheRowTest::item(['fileId' => 7, 'kind' => 'embedded', 'rating' => 9])]);
			$this->fail('A malformed row was accepted.');
		} catch (InvalidXmpCacheException) {
			$this->assertSame([], $this->store->rows);
		}
	}

	// spec: XMP-006.4
	public function testRefusesAFileIdGivenTwice(): void {
		$this->expectException(InvalidXmpCacheException::class);
		$this->service()->save($this->user(), [XmpCacheRowTest::item(), XmpCacheRowTest::item()]);
	}

	// spec: XMP-006.4
	public function testRefusesASaveOfMoreThanTheLimit(): void {
		$this->expectException(InvalidXmpCacheException::class);
		$this->service()->save($this->user(), array_fill(0, XmpCacheService::LIMIT + 1, XmpCacheRowTest::item()));
	}

	public function testAnEmptySaveWritesNothing(): void {
		$this->assertSame([], $this->service()->save($this->user(), []));
		$this->assertSame([], $this->store->rows);
	}
}
