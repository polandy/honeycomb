<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

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
	 * Stores the hashes in `$items` whose file the user reaches as a photo at that etag; returns their file ids in request order.
	 * @param array<array-key, mixed> $items
	 * @return list<int>
	 * @throws InvalidVisualHashException for a malformed item, a file id given twice or too many items
	 */
	public function save(IUser $user, array $items): array {
		$hashes = array_map(VisualHash::fromRequest(...), FileIds::items($items, self::SAVE_LIMIT, InvalidVisualHashException::class));
		$fileIds = FileIds::eachOnce(array_map(static fn (VisualHash $hash): int => $hash->fileId, $hashes), InvalidVisualHashException::class);
		$isCurrent = array_flip($this->photos->current($user, array_combine($fileIds, array_map(static fn (VisualHash $hash): string => $hash->etag, $hashes))));
		$current = array_values(array_filter($hashes, static fn (VisualHash $hash): bool => isset($isCurrent[$hash->fileId])));
		if ($current !== []) {
			RetryOnConflict::run(fn () => $this->store->replace($user->getUID(), $current));
		}
		return array_map(static fn (VisualHash $hash): int => $hash->fileId, $current);
	}
}
