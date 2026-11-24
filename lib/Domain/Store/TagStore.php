<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain\Store;

/** Where each user's tag list is kept (ADR 0022). */
interface TagStore extends UserRowStore {
	/**
	 * Adds the tags the tag list does not hold yet.
	 * @param list<string> $tags
	 */
	public function addToTagList(string $userId, array $tags): void;

	/**
	 * Every tag the user has had, sorted, each once.
	 * @return list<string>
	 */
	public function tagList(string $userId): array;
}
