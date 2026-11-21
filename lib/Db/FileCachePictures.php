<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Preview\UntypedRaw;
use OCA\Honeycomb\Service\PictureCount;
use OCA\Honeycomb\Service\PictureTally;
use OCA\Honeycomb\Service\PicturesBelow;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\Folder;
use OCP\Files\IMimeTypeLoader;
use OCP\Files\Mount\IMountManager;
use OCP\IDBConnection;

/**
 * Counts the pictures and orphaned sidecars below a folder from the names in the file cache, with
 * one query per storage: the folder's own subtree plus each storage mounted below it (ADR 0011).
 */
final class FileCachePictures implements PicturesBelow {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through the service alias. */
	public function __construct(
		private IDBConnection $db,
		private IMimeTypeLoader $mimeTypes,
		private IMountManager $mounts,
	) {
	}

	#[\Override]
	public function count(Folder $folder): ?PictureCount {
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
		$tally = array_map(fn (array $subtree): array => $this->tally(...$subtree), $subtrees);
		return new PictureCount(array_sum(array_column($tally, 'pictures')), array_sum(array_column($tally, 'orphans')), $approximate);
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

	/**
	 * The pictures and orphaned sidecars below `$path` of `$storage`, told folder by folder and
	 * leaving out every path with a hidden name.
	 * @return array{pictures: int, orphans: int}
	 */
	private function tally(int $storage, string $path): array {
		$query = $this->db->getQueryBuilder();
		$expr = $query->expr();
		$prefix = $path === '' ? '' : $this->db->escapeLikeParameter($path) . '/';
		$untypedRaws = array_map(static fn (string $extension): string => $expr->iLike('name', $query->createNamedParameter('%.' . $extension)), UntypedRaw::EXTENSIONS);
		$media = $expr->orX(
			$expr->eq('mimepart', $query->createNamedParameter($this->mimeTypes->getId('image'), IQueryBuilder::PARAM_INT)),
			$expr->eq('mimepart', $query->createNamedParameter($this->mimeTypes->getId('video'), IQueryBuilder::PARAM_INT)),
			$expr->iLike('name', $query->createNamedParameter('%.xmp')),
			...$untypedRaws,
		);
		$query->select('parent', 'name', 'mimepart')
			->from('filecache')
			->where($expr->eq('storage', $query->createNamedParameter($storage, IQueryBuilder::PARAM_INT)))
			->andWhere($expr->like('path', $query->createNamedParameter($prefix . '%')))
			->andWhere($expr->notLike('path', $query->createNamedParameter($prefix . '.%')))
			->andWhere($expr->notLike('path', $query->createNamedParameter($prefix . '%/.%')))
			->andWhere($media);
		$video = $this->mimeTypes->getId('video');
		$folders = [];
		$result = $query->executeQuery();
		while (($row = $result->fetch()) !== false) {
			$name = (string)$row['name'];
			$kind = str_ends_with(strtolower($name), '.xmp') ? 'sidecars' : ((int)$row['mimepart'] === $video ? 'videos' : 'photos');
			$folders[(int)$row['parent']][$kind][] = $name;
		}
		$result->closeCursor();
		$total = ['pictures' => 0, 'orphans' => 0];
		foreach ($folders as $names) {
			$own = PictureTally::of($names['photos'] ?? [], $names['videos'] ?? [], $names['sidecars'] ?? []);
			$total = ['pictures' => $total['pictures'] + $own['pictures'], 'orphans' => $total['orphans'] + $own['orphans']];
		}
		return $total;
	}
}
