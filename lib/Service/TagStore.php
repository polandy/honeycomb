<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the tags of each user are kept, by file id, with the user's tag list (ADR 0022). */
interface TagStore extends FileRowStore {
	/**
	 * The stored tags among `$fileIds`, in file id order.
	 * @param list<int> $fileIds
	 * @return list<PictureTags>
	 */
	public function find(string $userId, array $fileIds): array;

	/**
	 * Removes the tags of `$fileIds`, stores `$pictures` and adds their tags to the tag list, all or nothing.
	 * @param list<int> $fileIds
	 * @param list<PictureTags> $pictures each with at least one tag
	 */
	public function replace(string $userId, array $fileIds, array $pictures): void;

	/**
	 * Every tag the user has had, sorted, each once.
	 * @return list<string>
	 */
	public function tagList(string $userId): array;
}
