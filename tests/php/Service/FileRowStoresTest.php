<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use PHPUnit\Framework\TestCase;

final class FileRowStoresTest extends TestCase {
	public function testListsEveryStoreWithItsKindAndItsSweepCursorKey(): void {
		$decisions = new FakeDecisionStore();
		$tags = new FakeTagStore();
		$hashes = new FakeVisualHashStore();

		$entries = (new FileRowStores($decisions, $tags, $hashes))->all();

		$this->assertSame(['decision', 'tag', 'visual hash'], array_map(static fn ($entry): string => $entry->kind, $entries));
		$this->assertSame(['vanished_after_decisions', 'vanished_after_file_tags', 'vanished_after_hashes'], array_map(static fn ($entry): string => $entry->cursorKey, $entries));
		$this->assertSame([$decisions, $tags, $hashes], array_map(static fn ($entry) => $entry->store, $entries));
	}

	public function testListsTheStoresAlone(): void {
		$decisions = new FakeDecisionStore();
		$tags = new FakeTagStore();
		$hashes = new FakeVisualHashStore();

		$this->assertSame([$decisions, $tags, $hashes], (new FileRowStores($decisions, $tags, $hashes))->stores());
	}
}
