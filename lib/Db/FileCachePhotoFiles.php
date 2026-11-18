<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Preview\UntypedRaw;
use OCA\Honeycomb\Service\PhotoCount;
use OCA\Honeycomb\Service\PhotoFilesBelow;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\Folder;
use OCP\Files\IMimeTypeLoader;
use OCP\Files\Mount\IMountManager;
use OCP\IDBConnection;

/**
 * Counts the photo files below a folder with one query per storage in the file cache: the
 * folder's own subtree plus each storage mounted below it (ADR 0011).
 */
final class FileCachePhotoFiles implements PhotoFilesBelow {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through the service alias. */
	public function __construct(
		private IDBConnection $db,
		private IMimeTypeLoader $mimeTypes,
		private IMountManager $mounts,
	) {
	}

	#[\Override]
	public function count(Folder $folder): ?PhotoCount {
		$own = $this->location($folder->getId());
		if ($own === null) {
			return null;
		}
		$approximate = SubtreeExactness::mayMissFiles($own['size'], $folder->getStorage());
		$subtrees = [$own['at']];
		foreach ($this->mounts->findIn($folder->getPath()) as $mount) {
			$below = substr($mount->getMountPoint(), strlen($folder->getPath()));
			if (str_contains($below, '/.')) {
				continue;
			}
			$root = $mount->getStorageRootId();
			$location = SubtreeExactness::unscannedMount($root) ? null : $this->location($root);
			if ($location === null) {
				$approximate = true;
			} elseif (!self::within($location['at'], $subtrees)) {
				$subtrees[] = $location['at'];
				$approximate = $approximate || SubtreeExactness::mayMissFiles($location['size'], $mount->getStorage());
			}
		}
		return new PhotoCount(array_sum(array_map(fn (array $subtree): int => $this->photoFiles(...$subtree), $subtrees)), $approximate);
	}

	/** @return ?array{at: array{int, string}, size: int} the storage, path and size of a file cache row */
	private function location(int $fileId): ?array {
		$query = $this->db->getQueryBuilder();
		$query->select('storage', 'path', 'size')
			->from('filecache')
			->where($query->expr()->eq('fileid', $query->createNamedParameter($fileId, IQueryBuilder::PARAM_INT)));
		$result = $query->executeQuery();
		$row = $result->fetch();
		$result->closeCursor();
		return $row === false ? null : ['at' => [(int)$row['storage'], (string)$row['path']], 'size' => (int)$row['size']];
	}

	/**
	 * Whether `$location` lies in one of `$subtrees`, so its files are counted already.
	 * @param array{int, string} $location
	 * @param list<array{int, string}> $subtrees
	 */
	private static function within(array $location, array $subtrees): bool {
		foreach ($subtrees as [$storage, $path]) {
			if ($location[0] === $storage && ($path === '' || str_starts_with($location[1] . '/', $path . '/'))) {
				return true;
			}
		}
		return false;
	}

	/** The photo files below `$path` of `$storage`, leaving out every path with a hidden name. */
	private function photoFiles(int $storage, string $path): int {
		$query = $this->db->getQueryBuilder();
		$expr = $query->expr();
		$prefix = $path === '' ? '' : $this->db->escapeLikeParameter($path) . '/';
		$untypedRaws = array_map(static fn (string $extension): string => $expr->iLike('name', $query->createNamedParameter('%.' . $extension)), UntypedRaw::EXTENSIONS);
		$photo = $expr->orX($expr->eq('mimepart', $query->createNamedParameter($this->mimeTypes->getId('image'), IQueryBuilder::PARAM_INT)), ...$untypedRaws);
		$query->select($query->func()->count('fileid', 'photos'))
			->from('filecache')
			->where($expr->eq('storage', $query->createNamedParameter($storage, IQueryBuilder::PARAM_INT)))
			->andWhere($expr->like('path', $query->createNamedParameter($prefix . '%')))
			->andWhere($expr->notLike('path', $query->createNamedParameter($prefix . '.%')))
			->andWhere($expr->notLike('path', $query->createNamedParameter($prefix . '%/.%')))
			->andWhere($photo);
		$result = $query->executeQuery();
		$count = (int)$result->fetchOne();
		$result->closeCursor();
		return $count;
	}
}
