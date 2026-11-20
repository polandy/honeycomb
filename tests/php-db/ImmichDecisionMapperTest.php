<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\ImmichDecisionMapper;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\ListingFilters;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;

/** The decision table of Immich assets (ADR 0043). */
final class ImmichDecisionMapperTest extends DbTestCase {
	/** More rows than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private ImmichDecisionMapper $decisions;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->decisions = new ImmichDecisionMapper($this->db);
	}

	private static function id(int $n): string {
		return sprintf('00000000-0000-4000-8000-%012d', $n);
	}

	private static function decision(int $n, Flag $flag = Flag::Picked, int $rating = 0, ?ColourLabel $label = null, int $takenAt = 1_000, ?string $model = 'Pixel 9 Pro', AssetKind $kind = AssetKind::Photo): AssetDecision {
		return new AssetDecision(self::id($n), $rating, $label, $flag, false, $takenAt, $model, $kind, '2026-11-19T08:00:00.000Z');
	}

	// spec: IMMICH-003.3
	public function testSavesWholeStatesOverTheEarlierRows(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1, Flag::Picked, 4, ColourLabel::Red), self::decision(2)], 100);
		$this->decisions->save('alice', 'alice-phone', [new AssetDecision(self::id(1), 0, null, Flag::Unflagged, true, 2_000, null, AssetKind::Live, '2026-11-20T08:00:00.000Z')], 200);

		$this->assertEquals([
			self::id(1) => new AssetDecision(self::id(1), 0, null, Flag::Unflagged, true, 2_000, null, AssetKind::Live, '2026-11-20T08:00:00.000Z'),
			self::id(2) => self::decision(2),
		], $this->decisions->find('alice', 'alice-phone', [self::id(1), self::id(2), self::id(3)]));
	}

	public function testFindsMoreAssetsThanOneInListTakes(): void {
		$all = array_map(self::decision(...), range(1, self::BEYOND_CHUNK));
		$this->decisions->save('alice', 'alice-phone', $all, 100);

		$this->assertCount(self::BEYOND_CHUNK, $this->decisions->find('alice', 'alice-phone', array_map(static fn (AssetDecision $d): string => $d->assetId, $all)));
	}

	// spec: IMMICH-003.8
	public function testConnectionsAndUsersAreApart(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1)], 100);

		$this->assertSame([], $this->decisions->find('alice', 'alice-tablet', [self::id(1)]));
		$this->assertSame([], $this->decisions->find('bob', 'alice-phone', [self::id(1)]));
	}

	// spec: IMMICH-003.9
	public function testForgettingAUserRemovesOnlyTheirRows(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1)], 100);
		$this->decisions->save('bob', 'bob-phone', [self::decision(1)], 100);

		$this->decisions->forgetUser('alice');

		$this->assertSame([], $this->decisions->find('alice', 'alice-phone', [self::id(1)]));
		$this->assertCount(1, $this->decisions->find('bob', 'bob-phone', [self::id(1)]));
	}

	// spec: IMMICH-002.22
	public function testPagesTheRowsPassingTheFiltersNewestFirstAfterTheKey(): void {
		$this->decisions->save('alice', 'alice-phone', [
			self::decision(1, Flag::Picked, takenAt: 3_000),
			self::decision(2, Flag::Picked, takenAt: 2_000),
			self::decision(3, Flag::Picked, takenAt: 2_000),
			self::decision(4, Flag::Rejected, takenAt: 2_500),
			self::decision(5, Flag::Picked, takenAt: 1_000, model: null),
			self::decision(6, Flag::Picked, takenAt: 500, kind: AssetKind::Video),
		], 100);
		$this->decisions->save('bob', 'alice-phone', [self::decision(7, takenAt: 2_000)], 100);
		$picked = new ListingFilters(['flags' => ['picked'], 'kinds' => ['photo']]);

		$first = $this->decisions->page('alice', 'alice-phone', $picked, null, 2);
		$next = $this->decisions->page('alice', 'alice-phone', $picked, ['takenAt' => 2_000, 'assetId' => self::id(3)], 10);

		$this->assertSame([self::id(1), self::id(3)], array_map(static fn (AssetDecision $d): string => $d->assetId, $first));
		$this->assertSame([self::id(2), self::id(5)], array_map(static fn (AssetDecision $d): string => $d->assetId, $next));
		$this->assertSame([self::id(5)], array_map(static fn (AssetDecision $d): string => $d->assetId, $this->decisions->page('alice', 'alice-phone', new ListingFilters(['flags' => ['picked'], 'devices' => [null], 'takenBefore' => 2_000]), null, 10)));
	}

	public function testPagesByRatingAndColourLabel(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1, Flag::Unflagged, 4, ColourLabel::Red), self::decision(2, Flag::Unflagged, 2), self::decision(3, Flag::Unflagged, 0, ColourLabel::Red)], 100);

		$ids = fn (array $raw): array => array_map(static fn (AssetDecision $d): string => $d->assetId, $this->decisions->page('alice', 'alice-phone', new ListingFilters($raw), null, 10));

		$this->assertSame([self::id(1)], $ids(['rating' => ['op' => 'atLeast', 'value' => 3]]));
		$this->assertSame([self::id(2)], $ids(['rating' => ['op' => 'exactly', 'value' => 2]]));
		$this->assertSame([self::id(1), self::id(3)], $ids(['colourLabels' => ['red']]));
	}

	// spec: IMMICH-002.13
	public function testGroupsTheRowsByDecisionUnderTheFacets(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1, Flag::Picked, 4, ColourLabel::Red), self::decision(2, Flag::Picked, 4, ColourLabel::Red), self::decision(3, Flag::Rejected), self::decision(4, Flag::Rejected, model: 'Pixel 7')], 100);
		$this->decisions->save('bob', 'alice-phone', [self::decision(5)], 100);

		$groups = $this->decisions->groups('alice', 'alice-phone', new ListingFilters(['devices' => ['Pixel 9 Pro'], 'flags' => ['picked']]));
		usort($groups, static fn (array $a, array $b): int => $a['flag']->value <=> $b['flag']->value);

		$this->assertEquals([['flag' => Flag::Picked, 'rating' => 4, 'colourLabel' => ColourLabel::Red, 'count' => 2], ['flag' => Flag::Rejected, 'rating' => 0, 'colourLabel' => null, 'count' => 1]], $groups);
	}

	// spec: IMMICH-003.12
	public function testRemovesTheUsersRowsOfTheAssetsGiven(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1), self::decision(2)], 100);
		$this->decisions->save('bob', 'alice-phone', [self::decision(3)], 100);

		$this->decisions->remove('alice', 'alice-phone', [self::id(1), self::id(3)]);

		$this->assertSame([self::id(2)], array_keys($this->decisions->find('alice', 'alice-phone', [self::id(1), self::id(2)])));
		$this->assertCount(1, $this->decisions->find('bob', 'alice-phone', [self::id(3)]));
	}

	// spec: IMMICH-003.10
	public function testKeepsOnlyTheRowsOfTheConnectionsGivenForTheirUser(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1)], 100);
		$this->decisions->save('alice', 'alice-removed', [self::decision(1)], 100);
		$this->decisions->save('alice', 'handed-over', [self::decision(1)], 100);

		$this->assertSame(2, $this->decisions->keepOnly([['alice-phone', 'alice'], ['handed-over', 'bob']]));

		$this->assertCount(1, $this->decisions->find('alice', 'alice-phone', [self::id(1)]));
		$this->assertSame([], $this->decisions->find('alice', 'handed-over', [self::id(1)]));
	}

	public function testKeepingNoConnectionRemovesEveryRow(): void {
		$this->decisions->save('alice', 'alice-phone', [self::decision(1)], 100);

		$this->assertSame(1, $this->decisions->keepOnly([]));
	}
}
