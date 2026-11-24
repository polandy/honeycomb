<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpReadState;
use OCA\Honeycomb\Service\XmpSource;

/** The XMP cache and the clearing of the visual hashes against a real database. */
final class XmpCacheMapperTest extends DbTestCase {
	private XmpCacheMapper $cache;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->cache = new XmpCacheMapper($this->db);
	}

	private static function stated(int $fileId): XmpCacheRow {
		return new XmpCacheRow($fileId, XmpSource::Sidecar, "etag-$fileId", 2, XmpReadState::Read, null, 0, Flag::Picked, ColourLabel::Magenta, false, ['Holiday', 'People/Anna']);
	}

	private static function silent(int $fileId): XmpCacheRow {
		return new XmpCacheRow($fileId, XmpSource::Embedded, "etag-$fileId", 1, XmpReadState::Refused, 'not-utf-8', null, null, null, null, null);
	}

	// spec: XMP-006.1
	public function testKeepsEveryFieldAndEveryNull(): void {
		$this->cache->replace('alice', [self::stated(7), self::silent(8)]);

		$this->assertEquals([7 => self::stated(7), 8 => self::silent(8)], $this->cache->find('alice', [7, 8, 9]));
		$this->assertSame([], $this->cache->find('bob', [7, 8]));
	}

	public function testASaveUpdatesTheRowInPlaceAndInsertsTheNewOnes(): void {
		$this->cache->replace('alice', [self::stated(7), self::stated(8)]);
		$before = $this->rowIds('honeycomb_xmp_cache');
		$this->cache->replace('alice', [self::silent(7), self::stated(9)]);

		$after = $this->rowIds('honeycomb_xmp_cache');
		$this->assertSame($before[7], $after[7]);
		$this->assertSame($before[8], $after[8]);
		$this->assertSame([7, 8, 9], array_keys($after));
	}

	// spec: XMP-006.2
	public function testASaveReplacesTheWholeRow(): void {
		$this->cache->replace('alice', [self::stated(7)]);
		$this->cache->replace('alice', [self::silent(7)]);

		$this->assertEquals([7 => self::silent(7)], $this->cache->find('alice', [7]));
	}

	// spec: XMP-006.5, XMP-006.6
	public function testClearsOneUserOrEveryUser(): void {
		$this->cache->replace('alice', [self::stated(7), self::stated(8)]);
		$this->cache->replace('bob', [self::stated(7)]);
		$this->cache->replace('carol', [self::stated(7)]);

		$this->assertSame(2, $this->cache->clear('alice'));
		$this->assertSame([], $this->cache->find('alice', [7, 8]));
		$this->assertCount(1, $this->cache->find('bob', [7]));
		$this->assertSame(2, $this->cache->clear(null));
		$this->assertSame([], $this->cache->find('carol', [7]));
	}

	// spec: STATS-001.45
	public function testCountsOnlyTheReadRowsOfTheUserByFlagAndRating(): void {
		$row = static fn (int $id, XmpReadState $state, ?Flag $flag, ?int $rating): XmpCacheRow => new XmpCacheRow($id, XmpSource::Sidecar, "etag-$id", 1, $state, null, $rating, $flag, null, null, null);
		$this->cache->replace('alice', [
			$row(1, XmpReadState::Read, Flag::Picked, 3),
			$row(2, XmpReadState::Read, Flag::Rejected, 0),
			$row(3, XmpReadState::Read, Flag::Unflagged, null),
			$row(4, XmpReadState::Refused, Flag::Picked, 5),
		]);
		$this->cache->replace('bob', [$row(9, XmpReadState::Read, Flag::Picked, 1)]);

		$this->assertSame(['pictures' => 3, 'picked' => 1, 'rejected' => 1, 'rated' => 1], $this->cache->readCounts('alice'));
		$this->assertSame(['pictures' => 0, 'picked' => 0, 'rejected' => 0, 'rated' => 0], $this->cache->readCounts('carol'));
	}
}
