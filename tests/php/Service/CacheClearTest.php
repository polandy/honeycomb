<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\CacheClear;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\XmpCacheRow;
use PHPUnit\Framework\TestCase;

final class CacheClearTest extends TestCase {
	private FakeXmpCacheStore $xmpCache;
	private FakeVisualHashStore $visualHashes;

	#[\Override]
	protected function setUp(): void {
		$row = XmpCacheRow::fromRequest(XmpCacheRowTest::item());
		$this->xmpCache = new FakeXmpCacheStore();
		$this->xmpCache->rows = ['alice' => [9 => $row, 10 => $row], 'bob' => [9 => $row]];
		$this->visualHashes = new FakeVisualHashStore();
		$this->visualHashes->rows = ['alice' => [7 => new VisualHash(7, 'etag-7', '00ff00ff00ff00ff')], 'bob' => [7 => new VisualHash(7, 'etag-7', '00ff00ff00ff00ff')]];
	}

	// spec: XMP-006.5
	public function testClearsOneUsersCacheAndVisualHashes(): void {
		$removed = (new CacheClear($this->xmpCache, $this->visualHashes))->clear('alice');

		$this->assertSame(3, $removed);
		$this->assertSame(['bob'], array_keys($this->xmpCache->rows));
		$this->assertSame(['bob'], array_keys($this->visualHashes->rows));
	}

	// spec: XMP-006.6
	public function testClearsEveryUser(): void {
		$removed = (new CacheClear($this->xmpCache, $this->visualHashes))->clear(null);

		$this->assertSame(5, $removed);
		$this->assertSame([], $this->xmpCache->rows);
		$this->assertSame([], $this->visualHashes->rows);
	}
}
