<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Lifecycle;

use OCA\Honeycomb\Domain\QualityValue;
use OCA\Honeycomb\Domain\VisualHash;
use OCA\Honeycomb\Domain\XmpCacheRow;
use OCA\Honeycomb\Service\Lifecycle\CacheClear;
use OCA\Honeycomb\Tests\Domain\XmpCacheRowTest;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use PHPUnit\Framework\TestCase;

final class CacheClearTest extends TestCase {
	private FakeXmpCacheStore $xmpCache;
	private FakeVisualHashStore $visualHashes;
	private FakeQualityStore $quality;

	#[\Override]
	protected function setUp(): void {
		$row = XmpCacheRow::fromRequest(XmpCacheRowTest::item());
		$this->xmpCache = new FakeXmpCacheStore();
		$this->xmpCache->rows = ['alice' => [9 => $row, 10 => $row], 'bob' => [9 => $row]];
		$this->visualHashes = new FakeVisualHashStore();
		$this->visualHashes->rows = [7 => new VisualHash(7, 'etag-7', 1, '00ff00ff00ff00ff')];
		$this->quality = new FakeQualityStore();
		$this->quality->rows = [7 => new QualityValue(7, 'etag-7', 1, 3.0, 0), 8 => new QualityValue(8, 'etag-8', 1, 4.0, 1)];
	}

	private function clear(): CacheClear {
		return new CacheClear($this->xmpCache, $this->visualHashes, $this->quality);
	}

	// spec: XMP-006.5, SERIES-006.20
	public function testClearsOneUsersCacheAndKeepsTheSharedHashesAndQualityValues(): void {
		$removed = $this->clear()->clear('alice');

		$this->assertSame(2, $removed);
		$this->assertSame(['bob'], array_keys($this->xmpCache->rows));
		$this->assertSame([7], array_keys($this->visualHashes->rows));
		$this->assertSame([7, 8], array_keys($this->quality->rows));
	}

	// spec: XMP-006.6, SERIES-006.20
	public function testClearsEveryUserWithTheHashesAndQualityValues(): void {
		$removed = $this->clear()->clear(null);

		$this->assertSame(6, $removed);
		$this->assertSame([], $this->xmpCache->rows);
		$this->assertSame([], $this->visualHashes->rows);
		$this->assertSame([], $this->quality->rows);
	}
}
