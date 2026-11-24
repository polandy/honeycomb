<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\Store\ExistingFiles;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Looks file ids up by primary key, without a join, so it works on a sharded file cache. */
final class FileCacheLookup implements ExistingFiles {
	/** Oracle takes at most 1,000 values in an `IN` list. */
	private const int IN_CHUNK = 1_000;
	/** Where the files app's trash bin keeps a user's deleted files, in their home storage. */
	private const string TRASH_BIN_PREFIX = 'files_trashbin/';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through the service alias. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	#[\Override]
	public function existing(array $fileIds): array {
		return $this->select($fileIds, false);
	}

	#[\Override]
	public function outsideTrashBin(array $fileIds): array {
		return $this->select($fileIds, true);
	}

	/**
	 * Compares the path in PHP: Nextcloud's `notLike` carries no `ESCAPE` on SQLite and Oracle.
	 *
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	private function select(array $fileIds, bool $outsideTrashBin): array {
		$found = [];
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('fileid', 'path')
				->from('filecache')
				->where($query->expr()->in('fileid', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)));
			$result = $query->executeQuery();
			while (($row = $result->fetch()) !== false) {
				if (!$outsideTrashBin || !str_starts_with((string)$row['path'], self::TRASH_BIN_PREFIX)) {
					$found[] = (int)$row['fileid'];
				}
			}
			$result->closeCursor();
		}
		return $found;
	}
}
