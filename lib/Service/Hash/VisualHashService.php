<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Hash;

use OCA\Honeycomb\Domain\FileIds;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Store\VisualHashStore;
use OCA\Honeycomb\Domain\VisualHash;
use OCA\Honeycomb\Service\Files\CurrentRows;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Support\RetryOnConflict;
use OCP\IUser;

/** Stores the visual hashes the browser computed, each only for the current version of a photo the user reaches (ADR 0024). */
final class VisualHashService {
	/** The most hashes one save may carry. */
	public const int SAVE_LIMIT = 1_000;

	public function __construct(
		private VisualHashStore $store,
		private UserPhotos $photos,
	) {
	}

	/**
	 * Stores the hashes in `$items` whose file the user reaches as a photo at that etag, repeated on a unique-key conflict
	 * (SERIES-003.9); returns their file ids in request order.
	 * @param array<array-key, mixed> $items
	 * @return list<int>
	 * @throws InvalidRequestException for a malformed item, a file id given twice or too many items
	 */
	public function save(IUser $user, array $items): array {
		$hashes = array_map(VisualHash::fromRequest(...), FileIds::items($items, self::SAVE_LIMIT));
		FileIds::eachOnce(array_map(static fn (VisualHash $hash): int => $hash->fileId, $hashes));
		$current = CurrentRows::of($this->photos, $user, $hashes);
		if ($current !== []) {
			RetryOnConflict::run(fn () => $this->store->replace($current));
		}
		return array_map(static fn (VisualHash $row): int => $row->fileId, $current);
	}
}
