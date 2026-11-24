<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\UserRowStores;
use OCA\Honeycomb\Tests\Immich\FakeImmichDecisionStore;
use PHPUnit\Framework\TestCase;

final class UserRowStoresTest extends TestCase {
	public function testListsEveryStoreThatKeepsRowsPerUser(): void {
		$tags = new FakeTagStore();
		$series = new FakeSeriesStore();
		$xmpCache = new FakeXmpCacheStore();
		$positions = new FakePositionStore();
		$stats = new FakeStatsStore();
		$immich = new FakeImmichDecisionStore();
		$done = new FakeFolderDoneStore();
		$flags = new FakeFlagStore();

		$all = (new UserRowStores($series, $xmpCache, $tags, $positions, $stats, $immich, $done, $flags))->all();

		$this->assertSame([$series, $xmpCache, $tags, $positions, $stats, $immich, $done, $flags], $all);
	}
}
