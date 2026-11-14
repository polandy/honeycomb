<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\UserRowStores;
use PHPUnit\Framework\TestCase;

final class UserRowStoresTest extends TestCase {
	public function testListsTheFileRowStoresAndThePositions(): void {
		$decisions = new FakeDecisionStore();
		$tags = new FakeTagStore();
		$hashes = new FakeVisualHashStore();
		$series = new FakeSeriesStore();
		$positions = new FakePositionStore();

		$all = (new UserRowStores(new FileRowStores($decisions, $tags, $hashes, $series), $positions))->all();

		$this->assertSame([$decisions, $tags, $hashes, $series, $positions], $all);
	}
}
