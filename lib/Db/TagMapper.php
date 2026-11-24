<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\Store\TagStore;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps each user's tag list in `honeycomb_tag_list` (ADR 0022). */
final class TagMapper implements TagStore {
	use UserRowQueries;

	private const string TAG_LIST_TABLE = 'honeycomb_tag_list';
	private const array TAG_LIST_COLUMNS = ['user_id' => IQueryBuilder::PARAM_STR, 'tag' => IQueryBuilder::PARAM_STR];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** Compared in PHP, as the database's collation may ignore case and accents (ADR 0022). */
	#[\Override]
	public function tagList(string $userId): array {
		$query = $this->db->getQueryBuilder();
		$query->select('tag')
			->from(self::TAG_LIST_TABLE)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)));
		$result = $query->executeQuery();
		$tags = array_unique(array_map(strval(...), $result->fetchAll(\PDO::FETCH_COLUMN)));
		$result->closeCursor();
		sort($tags, SORT_STRING);
		return $tags;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows(self::TAG_LIST_TABLE, $userId);
	}

	#[\Override]
	public function addToTagList(string $userId, array $tags): void {
		$this->insertRows(
			new InsertStatements(self::TAG_LIST_TABLE, self::TAG_LIST_COLUMNS),
			array_map(static fn (string $tag): array => ['user_id' => $userId, 'tag' => $tag], array_values(array_diff(array_unique($tags), $this->tagList($userId)))),
		);
	}
}
