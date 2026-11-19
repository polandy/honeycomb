<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use PHPUnit\Framework\TestCase;

final class FileRowStoresTest extends TestCase {
	// spec: XMP-006.8, DECISIONS-001.31
	public function testListsEveryStoreWithItsKindAndItsSweepCursorKey(): void {
		$flags = new FakeFlagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();

		$entries = (new FileRowStores($flags, $hashes, $series, $xmpCache))->all();

		$this->assertSame(['flag', 'visual hash', 'series member', 'xmp cache'], array_map(static fn ($entry): string => $entry->kind, $entries));
		$this->assertSame(['vanished_after_flags', 'vanished_after_hashes', 'vanished_after_series_files', 'vanished_after_xmp_cache'], array_map(static fn ($entry): string => $entry->cursorKey, $entries));
		$this->assertSame([$flags, $hashes, $series, $xmpCache], array_map(static fn ($entry) => $entry->store, $entries));
	}

	public function testListsTheStoresAlone(): void {
		$flags = new FakeFlagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();

		$this->assertSame([$flags, $hashes, $series, $xmpCache], (new FileRowStores($flags, $hashes, $series, $xmpCache))->stores());
	}
}
