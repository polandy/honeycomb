<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** Stores the quality values the browser measured, each only for the current version of a photo the user reaches (ADR 0046). */
final class QualityService {
	/** The most values one save may carry. */
	public const int SAVE_LIMIT = 1_000;

	public function __construct(
		private QualityStore $store,
		private UserPhotos $photos,
	) {
	}

	/**
	 * Stores the values in `$items` whose file the user reaches as a photo at that etag, repeated on a unique-key conflict
	 * (SERIES-006.13); returns their file ids in request order.
	 * @param array<array-key, mixed> $items
	 * @return list<int>
	 * @throws InvalidQualityValueException for a malformed item, a file id given twice or too many items
	 */
	public function save(IUser $user, array $items): array {
		$values = array_map(QualityValue::fromRequest(...), FileIds::items($items, self::SAVE_LIMIT, InvalidQualityValueException::class));
		FileIds::eachOnce(array_map(static fn (QualityValue $value): int => $value->fileId, $values), InvalidQualityValueException::class);
		$current = CurrentRows::of($this->photos, $user, $values);
		if ($current !== []) {
			RetryOnConflict::run(fn () => $this->store->replace($current));
		}
		return array_map(static fn (QualityValue $row): int => $row->fileId, $current);
	}
}
