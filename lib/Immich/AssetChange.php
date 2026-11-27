<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** One asset's change of a write, as the write plan made it, with the rating Immich holds afterwards (IMMICH-004.19). */
final readonly class AssetChange {
	private const array KEYS = ['assetId', 'immichRating', 'trash', 'restore', 'archived', 'favorite', 'rating'];
	private const array REQUIRED = ['assetId', 'immichRating'];
	private const int MIN_RATING = -1;
	private const int MAX_RATING = 5;
	/** Immich 3 takes no rating 0; none is null. */
	private const int NO_RATING = 0;

	/** @param array<string, bool|int|string|null> $fields the `PUT /assets/{id}` body, empty when nothing is set */
	private function __construct(
		public string $assetId,
		public bool $trash,
		public bool $restore,
		public array $fields,
		public ?int $immichRating,
	) {
	}

	/** One change of a write's body; anything malformed, or a trash beside another change, is a bad request. */
	public static function fromRequest(mixed $raw): self {
		if (!is_array($raw) || array_diff(array_keys($raw), self::KEYS) !== [] || array_diff(self::REQUIRED, array_keys($raw)) !== []) {
			throw self::malformed();
		}
		$assetId = $raw['assetId'];
		/** @var mixed $immichRating */
		$immichRating = $raw['immichRating'];
		if (!is_string($assetId) || preg_match(AssetDecision::ASSET_ID, $assetId) !== 1 || !self::isRating($immichRating)
			|| (array_key_exists('trash', $raw) && ($raw['trash'] !== true || count($raw) !== count(self::REQUIRED) + 1))
			|| (array_key_exists('restore', $raw) && $raw['restore'] !== true)
			|| (array_key_exists('rating', $raw) && $raw['rating'] !== $immichRating)) {
			throw self::malformed();
		}
		/** @var ?int $immichRating */
		return new self($assetId, isset($raw['trash']), isset($raw['restore']), self::fields($raw), $immichRating);
	}

	/**
	 * The Immich fields of the change.
	 * @param array<array-key, mixed> $raw
	 * @return array<string, bool|int|string|null>
	 */
	private static function fields(array $raw): array {
		$fields = [];
		foreach (['favorite' => 'isFavorite', 'archived' => 'visibility'] as $key => $field) {
			if (array_key_exists($key, $raw)) {
				$value = $raw[$key];
				if (!is_bool($value)) {
					throw self::malformed();
				}
				$fields[$field] = $key === 'archived' ? ($value ? 'archive' : 'timeline') : $value;
			}
		}
		if (array_key_exists('rating', $raw)) {
			/** @var ?int $rating checked equal to the Immich rating */
			$rating = $raw['rating'];
			$fields['rating'] = $rating;
		}
		return $fields;
	}

	/** A rating Immich takes: −1 to 5 without 0, or null for none. */
	private static function isRating(mixed $rating): bool {
		return $rating === null || (is_int($rating) && $rating >= self::MIN_RATING && $rating <= self::MAX_RATING && $rating !== self::NO_RATING);
	}

	private static function malformed(): ImmichException {
		return new ImmichException(ImmichError::Request);
	}
}
