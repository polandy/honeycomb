<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\ImmichDecisionMapper;
use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\ListingFilters;
use OCP\DB\QueryBuilder\IQueryBuilder;

/** The Immich decisions in the decision table and their facets (ADR 0043, 0054). */
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
		$this->assertSame([self::id(3), self::id(1)], $ids(['colourLabels' => ['red']]));
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

	// spec: IMMICH-003.22, IMMICH-003.3
	public function testKeepsTheDecisionInTheDecisionTableAndTheFacetsApart(): void {
		$this->insertFileRow();
		$this->decisions->save('alice', 'alice-phone', [self::decision(1, Flag::Rejected, 3, ColourLabel::Red), self::decision(2)], 100);
		$this->decisions->save('bob', 'bob-phone', [self::decision(3)], 100);
		$this->decisions->remove('alice', 'alice-phone', [self::id(2)]);
		$this->decisions->forgetUser('bob');
		$this->decisions->keepOnly([['alice-phone', 'alice']]);

		$this->assertSame([
			['file', '7', null, null, null, 'picked', null, null, '50', null],
			['immich', null, 'alice-phone', self::id(1), 'alice', 'rejected', '3', 'red', '100', 'alice'],
		], $this->rows('honeycomb_decisions', ['source', 'file_id', 'connection_id', 'asset_id', 'user_id', 'flag', 'rating', 'colour_label', 'updated_at', 'updated_by']));
		$this->assertSame([
			['alice-phone', self::id(1), 'alice', '1000', 'Pixel 9 Pro', 'photo', '2026-11-19T08:00:00.000Z'],
		], $this->rows('honeycomb_immich_assets', ['connection_id', 'asset_id', 'user_id', 'taken_at', 'camera_model', 'kind', 'asset_updated_at']));
	}

	public function testKeepingNoConnectionLeavesTheFileRows(): void {
		$this->insertFileRow();
		$this->decisions->save('alice', 'alice-phone', [self::decision(1)], 100);

		$this->assertSame(1, $this->decisions->keepOnly([]));
		$this->assertSame([['file']], $this->rows('honeycomb_decisions', ['source']));
	}

	/** A flag row of a file as ADR 0054 shapes it. */
	private function insertFileRow(): void {
		$query = $this->db->getQueryBuilder();
		$query->insert('honeycomb_decisions')->values([
			'source' => $query->createNamedParameter('file'),
			'file_id' => $query->createNamedParameter(7, IQueryBuilder::PARAM_INT),
			'flag' => $query->createNamedParameter('picked'),
			'keep_raw' => $query->createNamedParameter(false, IQueryBuilder::PARAM_BOOL),
			'updated_at' => $query->createNamedParameter(50, IQueryBuilder::PARAM_INT),
		])->executeStatement();
	}

	/**
	 * Every row of the table as strings, in row id order.
	 * @param list<string> $columns
	 * @return list<list<?string>>
	 */
	private function rows(string $table, array $columns): array {
		$query = $this->db->getQueryBuilder();
		$result = $query->select(...$columns)->from($table)->orderBy('id')->executeQuery();
		$rows = [];
		while (($row = $result->fetch()) !== false) {
			$rows[] = array_map(static fn (mixed $value): ?string => $value === null ? null : (string)$value, array_values($row));
		}
		$result->closeCursor();
		return $rows;
	}
}
