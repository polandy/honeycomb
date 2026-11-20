<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\UserRowStore;

/**
 * The decision table of Immich assets, one row per connection and asset (ADR 0043).
 * @psalm-type DecisionGroup = array{flag: Flag, rating: int, colourLabel: ?ColourLabel, count: int}
 */
interface ImmichDecisionStore extends UserRowStore {
	/**
	 * Replaces the rows of the assets with the decisions, as the user's, in one transaction.
	 * @param list<AssetDecision> $decisions
	 */
	public function save(string $userId, string $connectionId, array $decisions, int $updatedAt): void;

	/**
	 * The user's decisions on those of the assets that have a row.
	 * @param list<string> $assetIds
	 * @return array<string, AssetDecision> by asset id
	 */
	public function find(string $userId, string $connectionId, array $assetIds): array;

	/**
	 * The user's rows that pass every filter, newest capture time first, ties by asset id, after the key.
	 * @param ?array{takenAt: int, assetId: string} $after
	 * @return list<AssetDecision>
	 */
	public function page(string $userId, string $connectionId, ListingFilters $filters, ?array $after, int $limit): array;

	/**
	 * The user's rows under the time, device and kind filters, counted by flag, rating and colour label.
	 * @return list<DecisionGroup>
	 */
	public function groups(string $userId, string $connectionId, ListingFilters $filters): array;

	/**
	 * Removes the user's rows of the assets.
	 * @param list<string> $assetIds
	 */
	public function remove(string $userId, string $connectionId, array $assetIds): void;

	/**
	 * Removes every row whose connection and user are not among the pairs, and answers how many.
	 * @param list<array{string, string}> $kept (connection id, user id)
	 */
	public function keepOnly(array $kept): int;
}
