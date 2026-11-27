<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichWriteCandidates;
use OCA\Honeycomb\Immich\WrittenState;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichWriteCandidatesTest extends TestCase {
	use AssertsImmichFailure;

	private const string UPDATED_AT = '2026-11-19T08:00:00.000Z';

	private FakeImmichDecisionStore $store;
	private ImmichWriteCandidates $candidates;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeImmichDecisionStore();
		$this->candidates = new ImmichWriteCandidates($this->store);
	}

	// spec: IMMICH-004.22
	public function testAnswersTheUsersDecisionsWithWhatWasWrittenAndWhenTheyWereDecided(): void {
		$this->store->decide('alice', 'alice-phone', self::decision(2, Flag::Rejected, 3, ColourLabel::Red));
		$this->store->decide('alice', 'alice-phone', self::decision(1, Flag::Unflagged, 0));
		$this->store->decide('bob', 'alice-phone', self::decision(3, Flag::Picked, 0));
		$this->store->markWritten('alice', 'alice-phone', [self::id(2) => new WrittenState(Flag::Rejected, 2, null)]);

		$this->assertSame(['candidates' => [
			['assetId' => self::id(1), 'decision' => ['rating' => 0, 'colourLabel' => null, 'flag' => 'unflagged', 'keepRaw' => true], 'written' => null, 'decidedUpdatedAt' => self::UPDATED_AT],
			['assetId' => self::id(2), 'decision' => ['rating' => 3, 'colourLabel' => 'red', 'flag' => 'rejected', 'keepRaw' => true], 'written' => ['flag' => 'rejected', 'rating' => 2, 'immichRating' => null], 'decidedUpdatedAt' => self::UPDATED_AT],
		], 'nextCursor' => null], $this->candidates->page(self::connection(), null));
	}

	// spec: IMMICH-004.22
	public function testPagesOf500NameTheNextCursorOnlyWhileMoreFollow(): void {
		foreach (range(1, ImmichWriteCandidates::PAGE + 1) as $n) {
			$this->store->decide('alice', 'alice-phone', self::decision($n, Flag::Picked, 0));
		}

		$first = $this->candidates->page(self::connection(), '');
		$this->assertCount(ImmichWriteCandidates::PAGE, $first['candidates']);
		$this->assertSame(self::id(ImmichWriteCandidates::PAGE), $first['nextCursor']);

		$last = $this->candidates->page(self::connection(), $first['nextCursor']);
		$this->assertSame([self::id(ImmichWriteCandidates::PAGE + 1)], array_column($last['candidates'], 'assetId'));
		$this->assertNull($last['nextCursor']);
	}

	public function testAFullLastPageAndNoDecisionNameNoNextCursor(): void {
		$this->assertSame(['candidates' => [], 'nextCursor' => null], $this->candidates->page(self::connection(), null));

		foreach (range(1, ImmichWriteCandidates::PAGE) as $n) {
			$this->store->decide('alice', 'alice-phone', self::decision($n, Flag::Picked, 0));
		}
		$this->assertNull($this->candidates->page(self::connection(), null)['nextCursor']);
	}

	/** @return array<string, array{mixed}> */
	public static function malformedCursors(): array {
		return [
			'not an asset id' => ['zzz'],
			'upper case' => [strtoupper(self::id(1))],
			'not a string' => [[self::id(1)]],
		];
	}

	// spec: IMMICH-004.22
	#[DataProvider('malformedCursors')]
	public function testAMalformedCursorIsABadRequest(mixed $cursor): void {
		$this->assertFailsWith(ImmichError::Request, fn (): array => $this->candidates->page(self::connection(), $cursor));
	}

	private static function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}

	private static function id(int $n): string {
		return sprintf('00000000-0000-4000-8000-%012d', $n);
	}

	private static function decision(int $n, Flag $flag, int $rating, ?ColourLabel $label = null): AssetDecision {
		return new AssetDecision(self::id($n), $rating, $label, $flag, true, 1_000, null, AssetKind::Photo, self::UPDATED_AT);
	}
}
