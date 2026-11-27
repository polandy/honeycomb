<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/**
 * Pages the user's decisions on a connection for the write plan, from honeycomb's tables alone (IMMICH-004.22).
 *
 * @psalm-type Candidate = array{assetId: string, decision: array{rating: int, colourLabel: ?string, flag: string, keepRaw: bool}, written: ?array{flag: string, rating: int, immichRating: ?int}, decidedUpdatedAt: string}
 */
final class ImmichWriteCandidates {
	/** Candidates per page. */
	public const int PAGE = 500;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichDecisionStore $store,
	) {
	}

	/**
	 * The page after the cursor, an asset id or empty for the first; `nextCursor` is null after the last page.
	 * @return array{candidates: list<Candidate>, nextCursor: ?string}
	 */
	public function page(Connection $connection, mixed $cursor): array {
		if ($cursor !== null && $cursor !== '' && (!is_string($cursor) || preg_match(AssetDecision::ASSET_ID, $cursor) !== 1)) {
			throw new ImmichException(ImmichError::Request);
		}
		$rows = $this->store->candidates($connection->user, $connection->id, $cursor === '' ? null : $cursor, self::PAGE + 1);
		$more = count($rows) > self::PAGE;
		$rows = array_slice($rows, 0, self::PAGE);
		return [
			'candidates' => array_map(self::candidate(...), $rows),
			'nextCursor' => $more ? $rows[self::PAGE - 1]->assetId : null,
		];
	}

	/** @return Candidate */
	private static function candidate(AssetDecision $decision): array {
		$written = $decision->written;
		return [
			'assetId' => $decision->assetId,
			'decision' => ['rating' => $decision->rating, 'colourLabel' => $decision->colourLabel?->value, 'flag' => $decision->flag->value, 'keepRaw' => $decision->keepRaw],
			'written' => $written === null ? null : ['flag' => $written->flag->value, 'rating' => $written->rating, 'immichRating' => $written->immichRating],
			'decidedUpdatedAt' => $decision->assetUpdatedAt,
		];
	}
}
