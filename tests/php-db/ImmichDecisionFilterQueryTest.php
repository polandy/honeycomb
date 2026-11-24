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
use OCA\Honeycomb\Tests\Immich\DecisionFilterVectors;
use PHPUnit\Framework\Attributes\DataProviderExternal;

/** The decision query against the vectors the grid's filter shares (IMMICH-002.29). */
final class ImmichDecisionFilterQueryTest extends DbTestCase {
	private const string ASSET_ID = '00000000-0000-4000-8000-000000000001';
	private const int PAGE_SIZE = 10;

	// spec: IMMICH-002.29
	/** @param array<string, mixed> $raw */
	#[DataProviderExternal(DecisionFilterVectors::class, 'cases')]
	public function testTheQueryJudgesTheSharedVectorsAsTheGridDoes(array $raw, Flag $flag, int $rating, ?ColourLabel $colourLabel, bool $admits): void {
		$decisions = new ImmichDecisionMapper($this->db);
		$decisions->save('alice', 'alice-phone', [new AssetDecision(self::ASSET_ID, $rating, $colourLabel, $flag, false, 1_000, null, AssetKind::Photo, '2026-11-24T08:00:00.000Z')], 100);

		$page = $decisions->page('alice', 'alice-phone', new ListingFilters($raw), null, self::PAGE_SIZE);

		$this->assertSame($admits ? [self::ASSET_ID] : [], array_map(static fn (AssetDecision $row): string => $row->assetId, $page));
	}
}
