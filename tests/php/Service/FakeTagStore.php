<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\Store\TagStore;

/** Keeps the tag lists in memory, by user. */
final class FakeTagStore implements TagStore {
	/** @var array<string, list<string>> */
	public array $tagLists = [];

	#[\Override]
	public function addToTagList(string $userId, array $tags): void {
		$this->tagLists[$userId] = array_values(array_unique([...$this->tagLists[$userId] ?? [], ...$tags]));
	}

	#[\Override]
	public function tagList(string $userId): array {
		$tags = $this->tagLists[$userId] ?? [];
		sort($tags, SORT_STRING);
		return $tags;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		unset($this->tagLists[$userId]);
	}
}
