<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use PHPUnit\Framework\TestCase;

final class FileRowStoresTest extends TestCase {
	// spec: XMP-006.8, DECISIONS-001.31, SERIES-006.14, FOLDERS-001.17
	public function testListsEveryStoreWithItsKindAndItsSweepCursorKey(): void {
		$flags = new FakeFlagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();
		$quality = new FakeQualityStore();
		$summaries = new FakeFolderSummaryStore();
		$done = new FakeFolderDoneStore();

		$entries = (new FileRowStores($flags, $hashes, $series, $xmpCache, $quality, $summaries, $done))->all();

		$this->assertSame(['flag', 'visual hash', 'series member', 'xmp cache', 'quality value', 'folder summary', 'folder done'], array_map(static fn ($entry): string => $entry->kind, $entries));
		$this->assertSame(['vanished_after_flags', 'vanished_after_hashes', 'vanished_after_series_files', 'vanished_after_xmp_cache', 'vanished_after_quality', 'vanished_after_folder_summaries', 'vanished_after_folders_done'], array_map(static fn ($entry): string => $entry->cursorKey, $entries));
		$this->assertSame([$flags, $hashes, $series, $xmpCache, $quality, $summaries, $done], array_map(static fn ($entry) => $entry->store, $entries));
	}

	public function testListsTheStoresAlone(): void {
		$flags = new FakeFlagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();
		$quality = new FakeQualityStore();
		$summaries = new FakeFolderSummaryStore();
		$done = new FakeFolderDoneStore();

		$this->assertSame([$flags, $hashes, $series, $xmpCache, $quality, $summaries, $done], (new FileRowStores($flags, $hashes, $series, $xmpCache, $quality, $summaries, $done))->stores());
	}
}
