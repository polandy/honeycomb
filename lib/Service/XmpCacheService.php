<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** Looks up and stores the user's XMP cache, each row only for a file the user reaches as its kind (ADR 0032). */
final class XmpCacheService {
	/** The most file ids one lookup and the most rows one save may carry: a large folder in one call. */
	public const int LIMIT = 60_000;

	public function __construct(
		private XmpCacheStore $store,
		private TagStore $tags,
		private UserPhotos $photos,
	) {
	}

	/**
	 * The user's stored rows among `$fileIds`; the client compares their etags.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<XmpCacheRow>
	 * @throws InvalidXmpCacheException for a malformed request or too many file ids
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$fileIds = FileIds::parse($fileIds, self::LIMIT, InvalidXmpCacheException::class);
		return array_values($this->store->find($user->getUID(), $fileIds));
	}

	/**
	 * Stores the rows in `$items` whose file the user reaches as that kind and adds their tags to the tag list (XMP-006.9); returns their file ids in request order.
	 * @param array<array-key, mixed> $items
	 * @return list<int>
	 * @throws InvalidXmpCacheException for a malformed row, a file id given twice or too many rows
	 */
	public function save(IUser $user, array $items): array {
		$rows = array_map(XmpCacheRow::fromRequest(...), FileIds::items($items, self::LIMIT, InvalidXmpCacheException::class));
		FileIds::eachOnce(array_map(static fn (XmpCacheRow $row): int => $row->fileId, $rows), InvalidXmpCacheException::class);
		if ($rows === []) {
			return [];
		}
		$reached = $this->reached($user, $rows);
		if ($reached !== []) {
			RetryOnConflict::run(fn () => $this->store->replace($user->getUID(), $reached));
			RetryOnConflict::run(fn () => $this->tags->addToTagList($user->getUID(), array_merge(...array_map(static fn (XmpCacheRow $row): array => $row->tags ?? [], $reached))));
		}
		return array_map(static fn (XmpCacheRow $row): int => $row->fileId, $reached);
	}

	/**
	 * The rows the user reaches as their kind, in request order: a sidecar row needs a sidecar, an embedded row a JPEG.
	 * @param list<XmpCacheRow> $rows
	 * @return list<XmpCacheRow>
	 */
	private function reached(IUser $user, array $rows): array {
		$idsOf = static fn (XmpSource $kind): array => array_map(static fn (XmpCacheRow $row): int => $row->fileId, array_values(array_filter($rows, static fn (XmpCacheRow $row): bool => $row->kind === $kind)));
		$reached = array_flip([...$this->photos->sidecars($user, $idsOf(XmpSource::Sidecar)), ...$this->photos->jpegs($user, $idsOf(XmpSource::Embedded))]);
		return array_values(array_filter($rows, static fn (XmpCacheRow $row): bool => isset($reached[$row->fileId])));
	}
}
