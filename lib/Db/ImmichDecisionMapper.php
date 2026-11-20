<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\ImmichDecisionStore;
use OCA\Honeycomb\Immich\ListingFilters;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps the whole decision of each Immich asset per connection in `honeycomb_immich_assets` (ADR 0043). */
final class ImmichDecisionMapper implements ImmichDecisionStore {
	use TTransactional;
	use UserRowQueries;

	private const string TABLE = 'honeycomb_immich_assets';
	/** Keeps an `IN` list within every database's limit. */
	private const int IN_CHUNK = 1_000;
	private const array COLUMNS = [
		'connection_id' => IQueryBuilder::PARAM_STR,
		'asset_id' => IQueryBuilder::PARAM_STR,
		'user_id' => IQueryBuilder::PARAM_STR,
		'rating' => IQueryBuilder::PARAM_INT,
		'colour_label' => IQueryBuilder::PARAM_STR,
		'flag' => IQueryBuilder::PARAM_STR,
		'keep_raw' => IQueryBuilder::PARAM_BOOL,
		'taken_at' => IQueryBuilder::PARAM_INT,
		'camera_model' => IQueryBuilder::PARAM_STR,
		'kind' => IQueryBuilder::PARAM_STR,
		'asset_updated_at' => IQueryBuilder::PARAM_STR,
		'updated_at' => IQueryBuilder::PARAM_INT,
	];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** The asset's row under the connection is replaced whoever kept it, as the unique index allows one. */
	#[\Override]
	public function save(string $userId, string $connectionId, array $decisions, int $updatedAt): void {
		$this->atomic(function () use ($userId, $connectionId, $decisions, $updatedAt): void {
			foreach (array_chunk(array_map(static fn (AssetDecision $decision): string => $decision->assetId, $decisions), self::IN_CHUNK) as $chunk) {
				$query = $this->db->getQueryBuilder();
				$query->delete(self::TABLE)
					->where($query->expr()->eq('connection_id', $query->createNamedParameter($connectionId)))
					->andWhere($query->expr()->in('asset_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_STR_ARRAY)))
					->executeStatement();
			}
			$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), array_map(static fn (AssetDecision $decision): array => [
				'connection_id' => $connectionId,
				'asset_id' => $decision->assetId,
				'user_id' => $userId,
				'rating' => $decision->rating,
				'colour_label' => $decision->colourLabel?->value,
				'flag' => $decision->flag->value,
				'keep_raw' => $decision->keepRaw,
				'taken_at' => $decision->takenAt,
				'camera_model' => $decision->cameraModel,
				'kind' => $decision->kind->value,
				'asset_updated_at' => $decision->assetUpdatedAt,
				'updated_at' => $updatedAt,
			], $decisions));
		}, $this->db);
	}

	#[\Override]
	public function find(string $userId, string $connectionId, array $assetIds): array {
		$found = [];
		foreach (array_chunk($assetIds, self::IN_CHUNK) as $chunk) {
			$query = $this->owned($userId, $connectionId)->select('*');
			$query->andWhere($query->expr()->in('asset_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_STR_ARRAY)));
			foreach ($this->rows($query) as $row) {
				$decision = self::fromRow($row);
				$found[$decision->assetId] = $decision;
			}
		}
		return $found;
	}

	#[\Override]
	public function page(string $userId, string $connectionId, ListingFilters $filters, ?array $after, int $limit): array {
		$query = $this->owned($userId, $connectionId)->select('*');
		$this->whereFacets($query, $filters);
		$expr = $query->expr();
		if ($filters->flags !== []) {
			$query->andWhere($expr->in('flag', $query->createNamedParameter(array_map(static fn (Flag $flag): string => $flag->value, $filters->flags), IQueryBuilder::PARAM_STR_ARRAY)));
		}
		if ($filters->rating !== null) {
			$stars = $query->createNamedParameter($filters->rating['value'], IQueryBuilder::PARAM_INT);
			$query->andWhere(match ($filters->rating['op']) {
				'atLeast' => $expr->gte('rating', $stars),
				'atMost' => $expr->lte('rating', $stars),
				default => $expr->eq('rating', $stars),
			});
		}
		if ($filters->colourLabels !== []) {
			$query->andWhere($expr->in('colour_label', $query->createNamedParameter(array_map(static fn (ColourLabel $label): string => $label->value, $filters->colourLabels), IQueryBuilder::PARAM_STR_ARRAY)));
		}
		if ($after !== null) {
			$takenAt = $query->createNamedParameter($after['takenAt'], IQueryBuilder::PARAM_INT);
			$query->andWhere($expr->orX(
				$expr->lt('taken_at', $takenAt),
				$expr->andX($expr->eq('taken_at', $takenAt), $expr->lt('asset_id', $query->createNamedParameter($after['assetId']))),
			));
		}
		$query->orderBy('taken_at', 'DESC')->addOrderBy('asset_id', 'DESC')->setMaxResults($limit);
		return array_map(self::fromRow(...), $this->rows($query));
	}

	#[\Override]
	public function groups(string $userId, string $connectionId, ListingFilters $filters): array {
		$query = $this->owned($userId, $connectionId);
		$query->select('flag', 'rating', 'colour_label')->selectAlias($query->func()->count('*'), 'count')->groupBy('flag', 'rating', 'colour_label');
		$this->whereFacets($query, $filters);
		return array_map(static fn (array $row): array => [
			'flag' => Flag::from((string)$row['flag']),
			'rating' => (int)$row['rating'],
			'colourLabel' => $row['colour_label'] === null ? null : ColourLabel::from((string)$row['colour_label']),
			'count' => (int)$row['count'],
		], $this->rows($query));
	}

	#[\Override]
	public function remove(string $userId, string $connectionId, array $assetIds): void {
		foreach (array_chunk($assetIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->delete(self::TABLE)
				->where($query->expr()->eq('connection_id', $query->createNamedParameter($connectionId)))
				->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
				->andWhere($query->expr()->in('asset_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_STR_ARRAY)))
				->executeStatement();
		}
	}

	#[\Override]
	public function keepOnly(array $kept): int {
		$query = $this->db->getQueryBuilder();
		$query->selectDistinct(['connection_id', 'user_id'])->from(self::TABLE);
		$removed = 0;
		foreach ($this->rows($query) as $row) {
			$pair = [(string)$row['connection_id'], (string)$row['user_id']];
			if (!in_array($pair, $kept, true)) {
				$delete = $this->db->getQueryBuilder();
				$delete->delete(self::TABLE)
					->where($delete->expr()->eq('connection_id', $delete->createNamedParameter($pair[0])))
					->andWhere($delete->expr()->eq('user_id', $delete->createNamedParameter($pair[1])));
				$removed += $delete->executeStatement();
			}
		}
		return $removed;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows(self::TABLE, $userId);
	}

	/** A query of the user's rows under the connection. */
	private function owned(string $userId, string $connectionId): IQueryBuilder {
		$query = $this->db->getQueryBuilder();
		$query->from(self::TABLE)
			->where($query->expr()->eq('connection_id', $query->createNamedParameter($connectionId)))
			->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($userId)));
		return $query;
	}

	/** The time, device and kind filters on the facets the row copied from the listing. */
	private function whereFacets(IQueryBuilder $query, ListingFilters $filters): void {
		$expr = $query->expr();
		if ($filters->takenAfter !== null) {
			$query->andWhere($expr->gte('taken_at', $query->createNamedParameter($filters->takenAfter, IQueryBuilder::PARAM_INT)));
		}
		if ($filters->takenBefore !== null) {
			$query->andWhere($expr->lt('taken_at', $query->createNamedParameter($filters->takenBefore, IQueryBuilder::PARAM_INT)));
		}
		$models = array_values(array_filter($filters->devices, is_string(...)));
		$devices = $models === [] ? [] : [$expr->in('camera_model', $query->createNamedParameter($models, IQueryBuilder::PARAM_STR_ARRAY))];
		if (in_array(null, $filters->devices, true)) {
			$devices[] = $expr->isNull('camera_model');
		}
		if ($devices !== []) {
			$query->andWhere($expr->orX(...$devices));
		}
		if ($filters->kinds !== []) {
			$query->andWhere($expr->in('kind', $query->createNamedParameter(array_map(static fn (AssetKind $kind): string => $kind->value, $filters->kinds), IQueryBuilder::PARAM_STR_ARRAY)));
		}
	}

	/** @return list<array<string, mixed>> */
	private function rows(IQueryBuilder $query): array {
		$result = $query->executeQuery();
		$rows = $result->fetchAll();
		$result->closeCursor();
		return $rows;
	}

	/** @param array<string, mixed> $row */
	private static function fromRow(array $row): AssetDecision {
		return new AssetDecision(
			(string)$row['asset_id'],
			(int)$row['rating'],
			$row['colour_label'] === null ? null : ColourLabel::from((string)$row['colour_label']),
			Flag::from((string)$row['flag']),
			(bool)$row['keep_raw'],
			(int)$row['taken_at'],
			$row['camera_model'] === null ? null : (string)$row['camera_model'],
			AssetKind::from((string)$row['kind']),
			(string)$row['asset_updated_at'],
		);
	}
}
