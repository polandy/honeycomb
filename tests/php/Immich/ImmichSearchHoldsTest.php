<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\ImmichSearchFilter;
use PHPUnit\Framework\TestCase;

/** Immich 3.4.2's own answers to a search by ids, recorded from a real server, against the fake library (IMMICH-003.12). */
final class ImmichSearchHoldsTest extends TestCase {
	private const string FIXTURES = __DIR__ . '/../../fixtures/immich/';

	// spec: IMMICH-003.12
	public function testTheFakeHoldsTheTrashedAndArchivedAssetsLikeImmich(): void {
		$real = $this->items('search-held-by-ids.json');
		$ids = array_column($real, 'id');

		$answered = $this->fakeAnswer((new ImmichSearchFilter())->heldByIds($ids), $real);

		$this->assertSame($this->flags($real), $this->flags($answered));
		$this->assertSame([[false, 'timeline'], [true, 'timeline'], [false, 'archive']], array_values($this->flags($real)));
	}

	// spec: IMMICH-003.12
	public function testTheFakeListsOnlyTheVisibleUploadsLikeImmich(): void {
		$real = $this->items('search-held-by-ids.json');

		$answered = $this->fakeAnswer((new ImmichSearchFilter())->byIds(array_column($real, 'id')), $real);

		$this->assertSame($this->flags($this->items('search-uploads-by-ids.json')), $this->flags($answered));
		$this->assertCount(1, $answered);
	}

	/**
	 * @param array<string, mixed> $filter
	 * @param list<array<string, mixed>> $real
	 * @return list<array<string, mixed>>
	 */
	private function fakeAnswer(array $filter, array $real): array {
		$library = new FakeImmichLibrary();
		foreach ($real as $n => $item) {
			$library->add((string)$item['id'], 1_790_000_000 - $n, 0, [
				'trashedAt' => $item['isTrashed'] === true ? '2026-11-21T09:00:00.000Z' : null,
				'visibility' => $item['visibility'],
			]);
		}
		[, $body] = $library->search(['body' => json_encode(['filter' => $filter, 'size' => count($real)], JSON_THROW_ON_ERROR)]);
		/** @var array{assets: array{items: list<array<string, mixed>>}} $answer */
		$answer = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
		return $answer['assets']['items'];
	}

	/**
	 * @param list<array<string, mixed>> $items
	 * @return array<string, array{bool, string}>
	 */
	private function flags(array $items): array {
		$flags = [];
		foreach ($items as $item) {
			$flags[(string)$item['id']] = [$item['isTrashed'] ?? false, $item['visibility']];
		}
		return $flags;
	}

	/** @return list<array<string, mixed>> */
	private function items(string $name): array {
		/** @psalm-suppress ForbiddenCode Reads a test fixture, not a user file. */
		$answer = json_decode((string)file_get_contents(self::FIXTURES . $name), true, 512, JSON_THROW_ON_ERROR);
		return $answer['assets']['items'];
	}
}
