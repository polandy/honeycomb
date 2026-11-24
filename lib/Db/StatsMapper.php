<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\StatsCounter;
use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Domain\Store\StatsStore;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

final class StatsMapper implements StatsStore {
	use UserRowQueries;

	private const string TABLE = 'honeycomb_stats';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** Updates in place, so concurrent adds sum; only the first add of a day inserts. */
	#[\Override]
	public function add(string $userId, string $day, StatsMetric $metric, int $amount): void {
		$query = $this->db->getQueryBuilder();
		$value = $query->getColumnName('value');
		$sum = sprintf('%s + %s', $value, $query->createNamedParameter($amount, IQueryBuilder::PARAM_INT));
		$updated = $query->update(self::TABLE)
			->set('value', $query->createFunction(sprintf('CASE WHEN %1$s < 0 THEN 0 ELSE %1$s END', $sum)))
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('day', $query->createNamedParameter($day)))
			->andWhere($query->expr()->eq('metric', $query->createNamedParameter($metric->value)))
			->executeStatement();
		if ($updated > 0 || $amount <= 0) {
			return;
		}
		$insert = $this->db->getQueryBuilder();
		$insert->insert(self::TABLE)->values([
			'user_id' => $insert->createNamedParameter($userId),
			'day' => $insert->createNamedParameter($day),
			'metric' => $insert->createNamedParameter($metric->value),
			'value' => $insert->createNamedParameter($amount, IQueryBuilder::PARAM_INT),
		])->executeStatement();
	}

	#[\Override]
	public function between(string $userId, ?string $from, ?string $to): array {
		$query = $this->db->getQueryBuilder();
		$query->select('day', 'metric', 'value')
			->from(self::TABLE)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->orderBy('day')
			->addOrderBy('metric');
		if ($from !== null) {
			$query->andWhere($query->expr()->gte('day', $query->createNamedParameter($from)));
		}
		if ($to !== null) {
			$query->andWhere($query->expr()->lte('day', $query->createNamedParameter($to)));
		}
		$result = $query->executeQuery();
		$counters = [];
		while (($row = $result->fetch()) !== false) {
			$counters[] = new StatsCounter((string)$row['day'], (string)$row['metric'], (int)$row['value']);
		}
		$result->closeCursor();
		return $counters;
	}

	#[\Override]
	public function total(string $userId, StatsMetric $metric): int {
		$query = $this->db->getQueryBuilder();
		$query->select($query->func()->sum('value'))
			->from(self::TABLE)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('metric', $query->createNamedParameter($metric->value)));
		$result = $query->executeQuery();
		$total = (int)$result->fetchOne();
		$result->closeCursor();
		return $total;
	}

	#[\Override]
	public function firstDay(string $userId): ?string {
		$query = $this->db->getQueryBuilder();
		$query->select($query->func()->min('day'))
			->from(self::TABLE)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)));
		$result = $query->executeQuery();
		$day = (string)$result->fetchOne();
		$result->closeCursor();
		return $day === '' ? null : $day;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows(self::TABLE, $userId);
	}
}
