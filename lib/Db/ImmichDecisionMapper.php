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

/** Keeps each Immich asset's decision as a row of `honeycomb_decisions` and its facets in `honeycomb_immich_assets`, per connection (ADR 0043, 0054). */
final class ImmichDecisionMapper implements ImmichDecisionStore {
	use TTransactional;
	use UserRowQueries;

	private const string DECISIONS = 'honeycomb_decisions';
	private const string ASSETS = 'honeycomb_immich_assets';
	private const string SOURCE = 'immich';
	/** Keeps an `IN` list within every database's limit. */
	private const int IN_CHUNK = 1_000;
	private const array DECISION_COLUMNS = [
		'source' => IQueryBuilder::PARAM_STR,
		'connection_id' => IQueryBuilder::PARAM_STR,
		'asset_id' => IQueryBuilder::PARAM_STR,
		'user_id' => IQueryBuilder::PARAM_STR,
		'flag' => IQueryBuilder::PARAM_STR,
		'keep_raw' => IQueryBuilder::PARAM_BOOL,
		'rating' => IQueryBuilder::PARAM_INT,
		'colour_label' => IQueryBuilder::PARAM_STR,
		'updated_at' => IQueryBuilder::PARAM_INT,
		'updated_by' => IQueryBuilder::PARAM_STR,
	];
	private const array ASSET_COLUMNS = [
		'connection_id' => IQueryBuilder::PARAM_STR,
		'asset_id' => IQueryBuilder::PARAM_STR,
		'user_id' => IQueryBuilder::PARAM_STR,
		'taken_at' => IQueryBuilder::PARAM_INT,
		'camera_model' => IQueryBuilder::PARAM_STR,
		'kind' => IQueryBuilder::PARAM_STR,
		'asset_updated_at' => IQueryBuilder::PARAM_STR,
	];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** The asset's rows under the connection are replaced whoever kept them, as the unique indexes allow one. */
	#[\Override]
	public function save(string $userId, string $connectionId, array $decisions, int $updatedAt): void {
		$this->atomic(function () use ($userId, $connectionId, $decisions, $updatedAt): void {
			foreach (array_chunk(array_map(static fn (AssetDecision $decision): string => $decision->assetId, $decisions), self::IN_CHUNK) as $chunk) {
				foreach ([self::DECISIONS, self::ASSETS] as $table) {
					$query = $this->deleteFrom($table, $connectionId);
					$query->andWhere($query->expr()->in('asset_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_STR_ARRAY)))->executeStatement();
				}
			}
			$this->insertRows(new InsertStatements(self::DECISIONS, self::DECISION_COLUMNS), array_map(static fn (AssetDecision $decision): array => [
				'source' => self::SOURCE,
				'connection_id' => $connectionId,
				'asset_id' => $decision->assetId,
				'user_id' => $userId,
				'flag' => $decision->flag->value,
				'keep_raw' => $decision->keepRaw,
				'rating' => $decision->rating,
				'colour_label' => $decision->colourLabel?->value,
				'updated_at' => $updatedAt,
				'updated_by' => $userId,
			], $decisions));
			$this->insertRows(new InsertStatements(self::ASSETS, self::ASSET_COLUMNS), array_map(static fn (AssetDecision $decision): array => [
				'connection_id' => $connectionId,
				'asset_id' => $decision->assetId,
				'user_id' => $userId,
				'taken_at' => $decision->takenAt,
				'camera_model' => $decision->cameraModel,
				'kind' => $decision->kind->value,
				'asset_updated_at' => $decision->assetUpdatedAt,
			], $decisions));
		}, $this->db);
	}

	#[\Override]
	public function find(string $userId, string $connectionId, array $assetIds): array {
		$found = [];
		foreach (array_chunk($assetIds, self::IN_CHUNK) as $chunk) {
			$query = $this->owned($userId, $connectionId);
			$query->andWhere($query->expr()->in('d.asset_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_STR_ARRAY)));
			foreach ($this->rows($query) as $row) {
				$decision = self::fromRow($row);
				$found[$decision->assetId] = $decision;
			}
		}
		return $found;
	}

	#[\Override]
	public function page(string $userId, string $connectionId, ListingFilters $filters, ?array $after, int $limit): array {
		$query = $this->owned($userId, $connectionId);
		$this->whereFacets($query, $filters);
		$expr = $query->expr();
		if ($filters->flags !== []) {
			$query->andWhere($expr->in('d.flag', $query->createNamedParameter(array_map(static fn (Flag $flag): string => $flag->value, $filters->flags), IQueryBuilder::PARAM_STR_ARRAY)));
		}
		if ($filters->rating !== null) {
			$stars = $query->createNamedParameter($filters->rating['value'], IQueryBuilder::PARAM_INT);
			$query->andWhere(match ($filters->rating['op']) {
				'atLeast' => $expr->gte('d.rating', $stars),
				'atMost' => $expr->lte('d.rating', $stars),
				default => $expr->eq('d.rating', $stars),
			});
		}
		if ($filters->colourLabels !== []) {
			$query->andWhere($expr->in('d.colour_label', $query->createNamedParameter(array_map(static fn (ColourLabel $label): string => $label->value, $filters->colourLabels), IQueryBuilder::PARAM_STR_ARRAY)));
		}
		if ($after !== null) {
			$takenAt = $query->createNamedParameter($after['takenAt'], IQueryBuilder::PARAM_INT);
			$query->andWhere($expr->orX(
				$expr->lt('a.taken_at', $takenAt),
				$expr->andX($expr->eq('a.taken_at', $takenAt), $expr->lt('d.asset_id', $query->createNamedParameter($after['assetId']))),
			));
		}
		$query->orderBy('a.taken_at', 'DESC')->addOrderBy('d.asset_id', 'DESC')->setMaxResults($limit);
		return array_map(self::fromRow(...), $this->rows($query));
	}

	#[\Override]
	public function groups(string $userId, string $connectionId, ListingFilters $filters): array {
		$query = $this->joined($userId, $connectionId);
		$query->select('d.flag', 'd.rating', 'd.colour_label')->selectAlias($query->func()->count('*'), 'count')->groupBy('d.flag', 'd.rating', 'd.colour_label');
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
			foreach ([self::DECISIONS, self::ASSETS] as $table) {
				$query = $this->deleteFrom($table, $connectionId);
				$query->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
					->andWhere($query->expr()->in('asset_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_STR_ARRAY)))
					->executeStatement();
			}
		}
	}

	/** Counts the removed decisions; the facets of the same pairs go with them. */
	#[\Override]
	public function keepOnly(array $kept): int {
		$removed = 0;
		foreach ([self::DECISIONS, self::ASSETS] as $table) {
			$query = $this->db->getQueryBuilder();
			$query->selectDistinct(['connection_id', 'user_id'])->from($table);
			if ($table === self::DECISIONS) {
				$query->where($query->expr()->eq('source', $query->createNamedParameter(self::SOURCE)));
			}
			foreach ($this->rows($query) as $row) {
				$pair = [(string)$row['connection_id'], (string)$row['user_id']];
				if (!in_array($pair, $kept, true)) {
					$delete = $this->deleteFrom($table, $pair[0]);
					$deleted = $delete->andWhere($delete->expr()->eq('user_id', $delete->createNamedParameter($pair[1])))->executeStatement();
					$removed += $table === self::DECISIONS ? $deleted : 0;
				}
			}
		}
		return $removed;
	}

	/** A file row has no user, so only the user's Immich rows go. */
	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows(self::DECISIONS, $userId);
		$this->deleteUserRows(self::ASSETS, $userId);
	}

	/** A delete of the connection's rows in the asset table, or of its Immich rows in the decision table. */
	private function deleteFrom(string $table, string $connectionId): IQueryBuilder {
		$query = $this->db->getQueryBuilder();
		$query->delete($table)->where($query->expr()->eq('connection_id', $query->createNamedParameter($connectionId)));
		if ($table === self::DECISIONS) {
			$query->andWhere($query->expr()->eq('source', $query->createNamedParameter(self::SOURCE)));
		}
		return $query;
	}

	/** The user's decisions under the connection with their facets. */
	private function owned(string $userId, string $connectionId): IQueryBuilder {
		return $this->joined($userId, $connectionId)->select('d.asset_id', 'd.flag', 'd.keep_raw', 'd.rating', 'd.colour_label', 'a.taken_at', 'a.camera_model', 'a.kind', 'a.asset_updated_at');
	}

	/** A query of the user's decisions under the connection, `d`, joined to their facets, `a`. */
	private function joined(string $userId, string $connectionId): IQueryBuilder {
		$query = $this->db->getQueryBuilder();
		$expr = $query->expr();
		$query->from(self::DECISIONS, 'd')
			->innerJoin('d', self::ASSETS, 'a', $expr->andX($expr->eq('a.connection_id', 'd.connection_id'), $expr->eq('a.asset_id', 'd.asset_id')))
			->where($expr->eq('d.source', $query->createNamedParameter(self::SOURCE)))
			->andWhere($expr->eq('d.connection_id', $query->createNamedParameter($connectionId)))
			->andWhere($expr->eq('d.user_id', $query->createNamedParameter($userId)));
		return $query;
	}

	/** The time, device and kind filters on the facets the asset row copied from the listing. */
	private function whereFacets(IQueryBuilder $query, ListingFilters $filters): void {
		$expr = $query->expr();
		if ($filters->takenAfter !== null) {
			$query->andWhere($expr->gte('a.taken_at', $query->createNamedParameter($filters->takenAfter, IQueryBuilder::PARAM_INT)));
		}
		if ($filters->takenBefore !== null) {
			$query->andWhere($expr->lt('a.taken_at', $query->createNamedParameter($filters->takenBefore, IQueryBuilder::PARAM_INT)));
		}
		$models = array_values(array_filter($filters->devices, is_string(...)));
		$devices = $models === [] ? [] : [$expr->in('a.camera_model', $query->createNamedParameter($models, IQueryBuilder::PARAM_STR_ARRAY))];
		if (in_array(null, $filters->devices, true)) {
			$devices[] = $expr->isNull('a.camera_model');
		}
		if ($devices !== []) {
			$query->andWhere($expr->orX(...$devices));
		}
		if ($filters->kinds !== []) {
			$query->andWhere($expr->in('a.kind', $query->createNamedParameter(array_map(static fn (AssetKind $kind): string => $kind->value, $filters->kinds), IQueryBuilder::PARAM_STR_ARRAY)));
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
