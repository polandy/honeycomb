<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\DecisionFilter;
use OCA\Honeycomb\Immich\ListingFilters;
use OCP\DB\QueryBuilder\IQueryBuilder;

/** The parts of a query over the Immich decisions `d` and their facets `a`: facet and decision filters, keyset cursor (ADR 0044). */
final class ImmichListingQuery {
	/** The time, device and kind filters on the facets the asset row copied from the listing. */
	public static function whereFacets(IQueryBuilder $query, ListingFilters $filters): void {
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

	/** Each clause of the decision filter on its column of the decisions. */
	public static function whereDecisions(IQueryBuilder $query, DecisionFilter $filter): void {
		$expr = $query->expr();
		foreach ($filter->clauses() as $clause) {
			$column = 'd.' . $clause['column'];
			$operand = $clause['operand'];
			$query->andWhere(is_array($operand)
				? $expr->in($column, $query->createNamedParameter($operand, IQueryBuilder::PARAM_STR_ARRAY))
				: $expr->comparison($column, $clause['operator'], $query->createNamedParameter($operand, IQueryBuilder::PARAM_INT)));
		}
	}

	/**
	 * The rows after the cursor, newest capture first, then by asset id, at most `$limit`.
	 * @param ?array{takenAt: int, assetId: string} $after
	 */
	public static function pageAfter(IQueryBuilder $query, ?array $after, int $limit): void {
		$expr = $query->expr();
		if ($after !== null) {
			$takenAt = $query->createNamedParameter($after['takenAt'], IQueryBuilder::PARAM_INT);
			$query->andWhere($expr->orX(
				$expr->lt('a.taken_at', $takenAt),
				$expr->andX($expr->eq('a.taken_at', $takenAt), $expr->lt('d.asset_id', $query->createNamedParameter($after['assetId']))),
			));
		}
		$query->orderBy('a.taken_at', 'DESC')->addOrderBy('d.asset_id', 'DESC')->setMaxResults($limit);
	}
}
