<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\ExistingFiles;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Looks file ids up by primary key, without a join, so it works on a sharded file cache. */
final class FileCacheLookup implements ExistingFiles {
	/** Oracle takes at most 1,000 values in an `IN` list. */
	private const int IN_CHUNK = 1_000;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through the service alias. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	#[\Override]
	public function existing(array $fileIds): array {
		$existing = [];
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('fileid')
				->from('filecache')
				->where($query->expr()->in('fileid', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)));
			$result = $query->executeQuery();
			array_push($existing, ...array_map(intval(...), $result->fetchAll(\PDO::FETCH_COLUMN)));
			$result->closeCursor();
		}
		return $existing;
	}
}
