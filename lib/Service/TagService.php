<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** Reads and writes each user's tags per file id and their tag list (ADR 0022). */
final class TagService {
	public function __construct(
		private TagStore $store,
	) {
	}

	/**
	 * The user's stored tags among `$fileIds`; a file id without a row has no tags.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<PictureTags>
	 * @throws InvalidTagsException for anything but a list of positive file ids within the limit
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$this->checkSize($fileIds);
		foreach ($fileIds as $fileId) {
			if (!is_int($fileId) || $fileId < 1) {
				throw new InvalidTagsException('fileIds must be positive integers');
			}
		}
		/** @var list<int> $fileIds */
		return $this->store->find($user->getUID(), $fileIds);
	}

	/**
	 * Replaces the user's tags with the whole lists in `$items`, all or nothing.
	 * @param array<array-key, mixed> $items
	 * @throws InvalidTagsException for a malformed item or a file id given twice
	 */
	public function save(IUser $user, array $items): void {
		$this->checkSize($items);
		$pictures = array_map(PictureTags::fromRequest(...), $items);
		$fileIds = array_map(static fn (PictureTags $picture): int => $picture->fileId, $pictures);
		if (count(array_unique($fileIds)) !== count($fileIds)) {
			throw new InvalidTagsException('Each file id may appear only once');
		}
		$stored = array_values(array_filter($pictures, static fn (PictureTags $picture): bool => $picture->tags !== []));
		RetryOnConflict::run(fn () => $this->store->replace($user->getUID(), $fileIds, $stored));
	}

	/**
	 * Every tag the user has had, sorted, each once.
	 * @return list<string>
	 */
	public function tagList(IUser $user): array {
		return $this->store->tagList($user->getUID());
	}

	/**
	 * @param array<array-key, mixed> $list
	 * @psalm-assert list<mixed> $list
	 */
	private function checkSize(array $list): void {
		if (!array_is_list($list) || count($list) > ListingService::ENTRY_LIMIT) {
			throw new InvalidTagsException('Expected a list of at most ' . ListingService::ENTRY_LIMIT . ' items');
		}
	}
}
