<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\ImmichError;
use PHPUnit\Framework\TestCase;

/** The listing from an asset, for the resume position, and its newer pages (ADR 0044). */
final class ImmichListingFromTest extends TestCase {
	use AssertsImmichFailure;
	use FakeImmichServer;
	use ListsImmichPages;

	private FakeImmichLibrary $library;

	#[\Override]
	protected function setUp(): void {
		$this->library = new FakeImmichLibrary();
		$this->decisions = new FakeImmichDecisionStore();
		$this->immichRoute('POST /search/metadata', fn (array $options): array => $this->library->search($options));
	}

	// spec: IMMICH-002.34
	public function testAPageFromAnAssetStartsAtItAndItsPreviousCursorPagesTheNewerEntries(): void {
		foreach (range(1, 10) as $n) {
			$this->library->add(self::id($n), self::NOW - 3600 * $n);
		}

		$first = $this->listing()->page($this->connection(), [], null, 2, ['assetId' => self::id(6), 'takenAt' => self::NOW - 3600 * 6]);
		$older = $this->walk($first['nextCursor'], 'nextCursor');
		$newer = $this->walk($first['previousCursor'], 'previousCursor');

		$this->assertSame([self::id(6), self::id(7)], array_column($first['entries'], 'assetId'));
		$this->assertSame([[8, 9], [10]], $older);
		$this->assertSame([[5], [3, 4], [1, 2]], $newer);
	}

	// spec: IMMICH-002.34
	public function testUploadsOfTheAnchorsSecondSplitAtTheAnchorByTheirOrder(): void {
		foreach (['c', 'a', 'e', 'b', 'd'] as $letter) {
			$this->library->add(self::lettered($letter), self::NOW - 60);
		}

		$first = $this->listing()->page($this->connection(), [], null, 100, ['assetId' => self::lettered('c'), 'takenAt' => self::NOW - 60]);
		$newer = $this->listing()->page($this->connection(), [], $first['previousCursor'], 100);

		$this->assertSame([self::lettered('c'), self::lettered('b'), self::lettered('a')], array_column($first['entries'], 'assetId'));
		$this->assertSame([self::lettered('e'), self::lettered('d')], array_column($newer['entries'], 'assetId'));
		$this->assertSame([null, null], [$newer['nextCursor'], $newer['previousCursor']]);
	}

	// spec: IMMICH-002.34
	public function testAnAnchorTheListingNoLongerHoldsStartsAtTheNextOlderUpload(): void {
		foreach ([1, 2, 4] as $n) {
			$this->library->add(self::id($n), self::NOW - 3600 * $n);
		}

		$first = $this->listing()->page($this->connection(), [], null, 100, ['assetId' => self::id(3), 'takenAt' => self::NOW - 3600 * 3]);

		$this->assertSame([self::id(4)], array_column($first['entries'], 'assetId'));
		$this->assertSame([self::id(1), self::id(2)], array_column($this->listing()->page($this->connection(), [], $first['previousCursor'], 100)['entries'], 'assetId'));
	}

	// spec: IMMICH-002.34
	public function testTheNewerPagesAskImmichOldestFirstFromTheAnchorsSecondWithinTheFilters(): void {
		$first = $this->listing()->page($this->connection(), ['takenAfter' => self::NOW - 86_400], null, 10, ['assetId' => self::id(1), 'takenAt' => self::NOW - 3600]);
		$this->assertSame(['gte' => '2026-11-17T11:06:40Z', 'lt' => '2026-11-18T10:06:41Z'], $this->lastImmichTaken());

		$this->listing()->page($this->connection(), ['takenAfter' => self::NOW - 86_400], $first['previousCursor'], 10);

		$body = $this->lastImmichBody('POST /search/metadata');
		$this->assertIsArray($body);
		$this->assertSame(['field' => 'fileCreatedAt', 'direction' => 'asc'], $body['orderBy']);
		$this->assertSame(['gte' => '2026-11-18T10:06:40Z'], $this->lastImmichTaken());
	}

	// spec: IMMICH-002.35
	public function testAMalformedAnchorOneBesideACursorOrOneUnderADecisionFilterIsABadRequest(): void {
		$this->library->add(self::id(1), self::NOW - 60);
		$cursor = $this->listing()->page($this->connection(), [], null, 1)['nextCursor'];
		$anchor = ['assetId' => self::id(1), 'takenAt' => self::NOW - 60];

		foreach ([['assetId' => 'not-an-id', 'takenAt' => 1], ['assetId' => self::id(1)], ['assetId' => self::id(1), 'takenAt' => '1'], ['assetId' => self::id(1), 'takenAt' => -1]] as $bad) {
			$this->assertFailsWith(ImmichError::Request, fn () => $this->listing()->page($this->connection(), [], null, 1, $bad));
		}
		$this->assertFailsWith(ImmichError::Request, fn () => $this->listing()->page($this->connection(), [], $cursor ?? 'cursor', 1, $anchor));
		$this->assertFailsWith(ImmichError::Request, fn () => $this->listing()->page($this->connection(), ['flags' => ['picked']], null, 1, $anchor));
	}

	/**
	 * The asset numbers of each page along the cursor, until it ends.
	 * @return list<list<int>>
	 */
	private function walk(?string $cursor, string $end): array {
		$pages = [];
		while ($cursor !== null && count($pages) < 10) {
			$page = $this->listing()->page($this->connection(), [], $cursor, 2);
			$pages[] = array_map(static fn (string $id): int => (int)substr($id, -12), array_column($page['entries'], 'assetId'));
			$cursor = $end === 'nextCursor' ? $page['nextCursor'] : $page['previousCursor'];
		}
		return $pages;
	}

	private function lastImmichTaken(): mixed {
		/** @var mixed $body */
		$body = $this->lastImmichBody('POST /search/metadata');
		return is_array($body) && is_array($body['filter']) ? $body['filter']['takenAt'] ?? null : null;
	}

	private static function lettered(string $letter): string {
		return str_repeat($letter, 8) . '-0000-4000-8000-000000000000';
	}
}
