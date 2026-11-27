<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/**
 * Reloads the assets a write affects from Immich; the write plan in the browser finds the conflicts (IMMICH-004.18).
 *
 * @psalm-type SharedAlbum = array{name: string, others: int}
 * @psalm-type CheckedAsset = array{assetId: string, updatedAt: string, rating: ?int, favorite: bool, trashed: bool, archived: bool, sharedAlbum: ?SharedAlbum, stackSize: ?int}
 */
final class ImmichWriteCheck {
	/** At most this many assets per request (IMMICH-004.5). */
	public const int BLOCK = 100;
	private const string ARCHIVE = 'archive';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
		private ImmichSearchFilter $filter,
	) {
	}

	/**
	 * Immich's state of each asked asset it still holds, in the asked order; one it no longer holds is left out.
	 * @return array{assets: list<CheckedAsset>}
	 */
	public function check(Connection $connection, mixed $assetIds): array {
		$ids = $this->assetIds($assetIds);
		$items = $this->client->search($connection, ['filter' => $this->filter->heldByIds($ids), 'size' => count($ids), 'withExif' => true, 'withStacked' => true])['items'];
		$held = [];
		/** @var mixed $item */
		foreach ($items as $item) {
			/** @var mixed $id */
			$id = is_array($item) ? ($item['id'] ?? null) : null;
			if (is_string($id) && is_array($item)) {
				$held[$id] = $item;
			}
		}
		$assets = [];
		foreach ($ids as $id) {
			if (isset($held[$id])) {
				$assets[] = $this->checked($connection, $id, $held[$id]);
			}
		}
		return ['assets' => $assets];
	}

	/**
	 * The asked ids: a list of one to 100 distinct asset ids, else a bad request.
	 * @return non-empty-list<string>
	 */
	private function assetIds(mixed $assetIds): array {
		if (!is_array($assetIds) || $assetIds === [] || !array_is_list($assetIds) || count($assetIds) > self::BLOCK
			|| array_filter($assetIds, static fn (mixed $id): bool => !is_string($id) || preg_match(AssetDecision::ASSET_ID, $id) !== 1) !== []
			|| count(array_unique($assetIds)) !== count($assetIds)) {
			throw new ImmichException(ImmichError::Request);
		}
		/** @var non-empty-list<string> $assetIds */
		return $assetIds;
	}

	/**
	 * @param array<array-key, mixed> $asset
	 * @return CheckedAsset
	 */
	private function checked(Connection $connection, string $assetId, array $asset): array {
		/** @var mixed $exif */
		$exif = $asset['exifInfo'] ?? null;
		/** @var mixed $rating */
		$rating = is_array($exif) ? ($exif['rating'] ?? null) : null;
		$updatedAt = $asset['updatedAt'] ?? null;
		$favorite = $asset['isFavorite'] ?? null;
		$trashed = $asset['isTrashed'] ?? null;
		$visibility = $asset['visibility'] ?? null;
		if (!is_string($updatedAt) || !is_bool($favorite) || !is_bool($trashed) || !is_string($visibility) || ($rating !== null && !is_int($rating))) {
			throw new ImmichException(ImmichError::Version);
		}
		return [
			'assetId' => $assetId,
			'updatedAt' => $updatedAt,
			'rating' => $rating,
			'favorite' => $favorite,
			'trashed' => $trashed,
			'archived' => $visibility === self::ARCHIVE,
			'sharedAlbum' => $this->sharedAlbum($this->client->albums($connection, $assetId)),
			'stackSize' => $this->stackSize($assetId, $asset['stack'] ?? null),
		];
	}

	/** The size of the stack the asset tops; null when it tops none. */
	private function stackSize(string $assetId, mixed $stack): ?int {
		if (!is_array($stack) || ($stack['primaryAssetId'] ?? null) !== $assetId) {
			return null;
		}
		/** @var mixed $size */
		$size = $stack['assetCount'] ?? null;
		return is_int($size) ? $size : throw new ImmichException(ImmichError::Version);
	}

	/**
	 * The first shared album with the number of its members besides the key's account; null when none is shared.
	 * @param list<mixed> $albums
	 * @return ?SharedAlbum
	 */
	private function sharedAlbum(array $albums): ?array {
		/** @var mixed $album */
		foreach ($albums as $album) {
			$shared = is_array($album) ? ($album['shared'] ?? null) : null;
			$name = is_array($album) ? ($album['albumName'] ?? null) : null;
			$members = is_array($album) ? ($album['albumUsers'] ?? null) : null;
			if (!is_bool($shared) || !is_string($name) || !is_array($members)) {
				throw new ImmichException(ImmichError::Version);
			}
			if ($shared) {
				return ['name' => $name, 'others' => max(0, count($members) - 1)];
			}
		}
		return null;
	}
}
