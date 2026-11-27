<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\ImmichDecisionStore;
use OCA\Honeycomb\Immich\ListingFilters;
use OCA\Honeycomb\Immich\WrittenState;
use OCA\Honeycomb\Tests\Service\FakeDbException;

/** The decision table in memory, keyed by connection and asset like its unique index. */
final class FakeImmichDecisionStore implements ImmichDecisionStore {
	/** @var array<string, array{user: string, connection: string, decision: AssetDecision, updatedAt: int}> */
	public array $rows = [];
	public bool $keepOnlyFails = false;

	/** Saves the decision as the user's under the connection, as the save endpoint would. */
	public function decide(string $userId, string $connectionId, AssetDecision $decision): void {
		$this->save($userId, $connectionId, [$decision], 0);
	}

	#[\Override]
	public function save(string $userId, string $connectionId, array $decisions, int $updatedAt): void {
		foreach ($decisions as $decision) {
			$key = "$connectionId/{$decision->assetId}";
			$written = $this->rows[$key]['decision']->written ?? null;
			$this->rows[$key] = ['user' => $userId, 'connection' => $connectionId, 'decision' => self::withWritten($decision, $written), 'updatedAt' => $updatedAt];
		}
	}

	#[\Override]
	public function markWritten(string $userId, string $connectionId, array $written): void {
		foreach ($written as $assetId => $state) {
			$key = "$connectionId/$assetId";
			if (($this->rows[$key]['user'] ?? null) === $userId) {
				$this->rows[$key]['decision'] = self::withWritten($this->rows[$key]['decision'], $state);
			}
		}
	}

	#[\Override]
	public function find(string $userId, string $connectionId, array $assetIds): array {
		$found = [];
		foreach ($this->of($userId, $connectionId) as $decision) {
			if (in_array($decision->assetId, $assetIds, true)) {
				$found[$decision->assetId] = $decision;
			}
		}
		return $found;
	}

	#[\Override]
	public function page(string $userId, string $connectionId, ListingFilters $filters, ?array $after, int $limit): array {
		$rows = array_filter($this->facets($userId, $connectionId, $filters), static fn (AssetDecision $row): bool => $filters->admits($row->flag, $row->rating, $row->colourLabel)
			&& ($after === null || [$row->takenAt, $row->assetId] < [$after['takenAt'], $after['assetId']]));
		usort($rows, static fn (AssetDecision $a, AssetDecision $b): int => [$b->takenAt, $b->assetId] <=> [$a->takenAt, $a->assetId]);
		return array_slice($rows, 0, $limit);
	}

	#[\Override]
	public function groups(string $userId, string $connectionId, ListingFilters $filters): array {
		$groups = [];
		foreach ($this->facets($userId, $connectionId, $filters) as $row) {
			$key = "{$row->flag->value}/{$row->rating}/{$row->colourLabel?->value}";
			$groups[$key] ??= ['flag' => $row->flag, 'rating' => $row->rating, 'colourLabel' => $row->colourLabel, 'count' => 0];
			$groups[$key]['count']++;
		}
		return array_values($groups);
	}

	#[\Override]
	public function remove(string $userId, string $connectionId, array $assetIds): void {
		foreach ($assetIds as $assetId) {
			if (($this->rows["$connectionId/$assetId"]['user'] ?? null) === $userId) {
				unset($this->rows["$connectionId/$assetId"]);
			}
		}
	}

	#[\Override]
	public function keepOnly(array $kept): int {
		if ($this->keepOnlyFails) {
			throw new FakeDbException(0);
		}
		$before = count($this->rows);
		$this->rows = array_filter($this->rows, static fn (array $row): bool => in_array([$row['connection'], $row['user']], $kept, true));
		return $before - count($this->rows);
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->rows = array_filter($this->rows, static fn (array $row): bool => $row['user'] !== $userId);
	}

	/** @return list<AssetDecision> */
	private function of(string $userId, string $connectionId): array {
		$rows = array_filter($this->rows, static fn (array $row): bool => $row['user'] === $userId && $row['connection'] === $connectionId);
		return array_values(array_map(static fn (array $row): AssetDecision => $row['decision'], $rows));
	}

	/** @return list<AssetDecision> */
	private function facets(string $userId, string $connectionId, ListingFilters $filters): array {
		return array_values(array_filter($this->of($userId, $connectionId), static fn (AssetDecision $row): bool => ($filters->takenAfter === null || $row->takenAt >= $filters->takenAfter)
			&& ($filters->takenBefore === null || $row->takenAt < $filters->takenBefore)
			&& ($filters->devices === [] || in_array($row->cameraModel, $filters->devices, true))
			&& ($filters->kinds === [] || in_array($row->kind, $filters->kinds, true))));
	}

	/** The same decision with what was last written for it. */
	public static function withWritten(AssetDecision $decision, ?WrittenState $written): AssetDecision {
		return new AssetDecision($decision->assetId, $decision->rating, $decision->colourLabel, $decision->flag, $decision->keepRaw, $decision->takenAt, $decision->cameraModel, $decision->kind, $decision->assetUpdatedAt, $written);
	}
}
