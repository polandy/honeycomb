<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\TagStore;
use OCP\AppFramework\Db\QBMapper;
use OCP\AppFramework\Db\TTransactional;
use OCP\IDBConnection;

/** @template-extends QBMapper<FileTags> */
final class TagMapper extends QBMapper implements TagStore {
	use FileRowQueries;
	use TTransactional;

	private const string TAG_LIST_TABLE = 'honeycomb_tag_list';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'honeycomb_file_tags', FileTags::class);
	}

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		return array_map(static fn (array $row): PictureTags => FileTags::fromRow($row)->toPictureTags(), $this->findFileRows($userId, $fileIds));
	}

	#[\Override]
	public function replace(string $userId, array $fileIds, array $pictures): void {
		$this->atomic(function () use ($userId, $fileIds, $pictures): void {
			$this->deleteFileRows($userId, $fileIds);
			$tags = [];
			foreach ($pictures as $picture) {
				$this->insert(FileTags::of($userId, $picture));
				array_push($tags, ...$picture->tags);
			}
			$this->addToTagList($userId, $tags);
		}, $this->db);
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
		$this->atomic(function () use ($userId): void {
			$this->deleteUserRows($this->getTableName(), $userId);
			$this->deleteUserRows(self::TAG_LIST_TABLE, $userId);
		}, $this->db);
	}

	/** @param list<string> $tags */
	private function addToTagList(string $userId, array $tags): void {
		foreach (array_diff(array_unique($tags), $this->tagList($userId)) as $tag) {
			$query = $this->db->getQueryBuilder();
			$query->insert(self::TAG_LIST_TABLE)
				->values(['user_id' => $query->createNamedParameter($userId), 'tag' => $query->createNamedParameter($tag)])
				->executeStatement();
		}
	}
}
