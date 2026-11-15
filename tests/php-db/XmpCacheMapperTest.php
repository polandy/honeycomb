<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\VisualHash;
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
		return new XmpCacheRow($fileId, XmpSource::Sidecar, "etag-$fileId", 2, XmpReadState::Read, null, 0, Flag::Picked, ColourLabel::Purple, false, ['Holiday', 'People/Anna']);
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

	// spec: XMP-006.5, XMP-006.6
	public function testClearsTheVisualHashesOfOneUserOrEveryUser(): void {
		$hashes = new VisualHashMapper($this->db);
		$hashes->replace('alice', [new VisualHash(7, 'etag-7', '00ff00ff00ff00ff')]);
		$hashes->replace('bob', [new VisualHash(7, 'etag-7', '00ff00ff00ff00ff')]);

		$this->assertSame(1, $hashes->clear('alice'));
		$this->assertSame([], $hashes->find('alice', [7]));
		$this->assertCount(1, $hashes->find('bob', [7]));
		$this->assertSame(1, $hashes->clear(null));
		$this->assertSame([], $hashes->find('bob', [7]));
	}
}
