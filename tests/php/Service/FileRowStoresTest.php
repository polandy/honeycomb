<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use PHPUnit\Framework\TestCase;

final class FileRowStoresTest extends TestCase {
	// spec: XMP-006.8
	public function testListsEveryStoreWithItsKindAndItsSweepCursorKey(): void {
		$decisions = new FakeDecisionStore();
		$tags = new FakeTagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();

		$entries = (new FileRowStores($decisions, $tags, $hashes, $series, $xmpCache))->all();

		$this->assertSame(['decision', 'tag', 'visual hash', 'series member', 'xmp cache'], array_map(static fn ($entry): string => $entry->kind, $entries));
		$this->assertSame(['vanished_after_decisions', 'vanished_after_file_tags', 'vanished_after_hashes', 'vanished_after_series_files', 'vanished_after_xmp_cache'], array_map(static fn ($entry): string => $entry->cursorKey, $entries));
		$this->assertSame([$decisions, $tags, $hashes, $series, $xmpCache], array_map(static fn ($entry) => $entry->store, $entries));
	}

	public function testListsTheStoresAlone(): void {
		$decisions = new FakeDecisionStore();
		$tags = new FakeTagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();

		$this->assertSame([$decisions, $tags, $hashes, $series, $xmpCache], (new FileRowStores($decisions, $tags, $hashes, $series, $xmpCache))->stores());
	}
}
