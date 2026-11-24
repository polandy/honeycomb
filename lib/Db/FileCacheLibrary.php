<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\LibraryFolder;
use OCA\Honeycomb\Domain\SeriesStatus;
use OCA\Honeycomb\Domain\Store\LibraryFiles;
use OCA\Honeycomb\Domain\UntypedRaw;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\Folder;
use OCP\Files\IMimeTypeLoader;
use OCP\IDBConnection;

/** Reads the library folders, their photo files and the decisions on them from the file cache, one query each (ADR 0049). */
final class FileCacheLibrary implements LibraryFiles {
	/** Folder ids per `IN` list. */
	private const int IN_CHUNK = 1_000;
	private const string FOLDER_MIMETYPE = 'httpd/unix-directory';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through the service alias. */
	public function __construct(
		private IDBConnection $db,
		private IMimeTypeLoader $mimeTypes,
	) {
	}

	#[\Override]
	public function folders(Folder $root): array {
		$query = $this->db->getQueryBuilder();
		$query->select('storage', 'path')
			->from('filecache')
			->where($query->expr()->eq('fileid', $query->createNamedParameter($root->getId(), IQueryBuilder::PARAM_INT)));
		$result = $query->executeQuery();
		$location = $result->fetch();
		$result->closeCursor();
		if ($location === false) {
			return [];
		}
		$rootPath = (string)$location['path'];
		$prefix = $this->db->escapeLikeParameter($rootPath) . '/';
		$query = $this->db->getQueryBuilder();
		$expr = $query->expr();
		$query->select('fileid', 'path', 'etag', 'permissions')
			->from('filecache')
			->where($expr->eq('storage', $query->createNamedParameter((int)$location['storage'], IQueryBuilder::PARAM_INT)))
			->andWhere($expr->eq('mimetype', $query->createNamedParameter($this->mimeTypes->getId(self::FOLDER_MIMETYPE), IQueryBuilder::PARAM_INT)))
			->andWhere($expr->orX(
				$expr->eq('fileid', $query->createNamedParameter($root->getId(), IQueryBuilder::PARAM_INT)),
				$expr->andX(
					$expr->like('path', $query->createNamedParameter($prefix . '%')),
					$expr->notLike('path', $query->createNamedParameter($prefix . '.%')),
					$expr->notLike('path', $query->createNamedParameter($prefix . '%/.%')),
				),
			));
		$folders = [];
		$result = $query->executeQuery();
		while (($row = $result->fetch()) !== false) {
			$folders[] = new LibraryFolder((int)$row['fileid'], substr((string)$row['path'], strlen($rootPath)), (string)$row['etag'], (int)$row['permissions']);
		}
		$result->closeCursor();
		usort($folders, static fn (LibraryFolder $a, LibraryFolder $b): int => strcmp($a->path, $b->path));
		return $folders;
	}

	#[\Override]
	public function photoFiles(array $folderIds): array {
		$files = [];
		foreach (array_chunk($folderIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$expr = $query->expr();
			$untypedRaws = array_map(static fn (string $extension): string => $expr->iLike('name', $query->createNamedParameter('%.' . $extension)), UntypedRaw::EXTENSIONS);
			$query->select('fileid', 'parent', 'name', 'size', 'mtime')
				->from('filecache')
				->where($expr->in('parent', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->andWhere($expr->notLike('name', $query->createNamedParameter('.%')))
				->andWhere($expr->orX(
					$expr->eq('mimepart', $query->createNamedParameter($this->mimeTypes->getId('image'), IQueryBuilder::PARAM_INT)),
					...$untypedRaws,
				));
			$result = $query->executeQuery();
			while (($row = $result->fetch()) !== false) {
				$files[] = ['fileId' => (int)$row['fileid'], 'parent' => (int)$row['parent'], 'name' => (string)$row['name'], 'size' => (int)$row['size'], 'mtime' => (int)$row['mtime']];
			}
			$result->closeCursor();
		}
		return $files;
	}

	/** One query per chunk: the file cache joined with the flags and the user's done series. */
	#[\Override]
	public function decisionRows(string $userId, array $folderIds): array {
		$rows = [];
		foreach (array_chunk($folderIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$expr = $query->expr();
			$query->select('f.parent', 'f.name', 'fl.flag', 'fl.updated_at')
				->selectAlias('s.id', 'done_series')
				->from('filecache', 'f')
				->leftJoin('f', 'honeycomb_decisions', 'fl', $expr->eq('fl.file_id', 'f.fileid'))
				->leftJoin('f', 'honeycomb_series_files', 'sf', $expr->andX(
					$expr->eq('sf.file_id', 'f.fileid'),
					$expr->eq('sf.user_id', $query->createNamedParameter($userId)),
				))
				->leftJoin('sf', 'honeycomb_series', 's', $expr->andX(
					$expr->eq('s.id', 'sf.series_id'),
					$expr->eq('s.status', $query->createNamedParameter(SeriesStatus::Done->value)),
				))
				->where($expr->in('f.parent', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->andWhere($expr->orX($expr->isNotNull('fl.file_id'), $expr->isNotNull('s.id')));
			$result = $query->executeQuery();
			while (($row = $result->fetch()) !== false) {
				$rows[] = [
					'parent' => (int)$row['parent'],
					'name' => (string)$row['name'],
					'flag' => $row['flag'] === null ? null : (string)$row['flag'],
					'updatedAt' => $row['updated_at'] === null ? null : (int)$row['updated_at'],
					'doneSeries' => $row['done_series'] !== null,
				];
			}
			$result->closeCursor();
		}
		return $rows;
	}
}
