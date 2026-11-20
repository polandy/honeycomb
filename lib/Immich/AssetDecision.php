<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;

/** The whole decision on one Immich asset with the facets the listing delivered (ADR 0043). */
final readonly class AssetDecision {
	/** An Immich asset id: a UUID in lower case. */
	public const string ASSET_ID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';
	private const array KEYS = ['assetId', 'rating', 'colourLabel', 'flag', 'keepRaw', 'takenAt', 'cameraModel', 'kind', 'assetUpdatedAt'];
	private const int MAX_RATING = 5;
	/** The widths of their columns. */
	private const int CAMERA_MODEL_LENGTH = 128;
	private const int TIME_LENGTH = 32;

	public function __construct(
		public string $assetId,
		public int $rating,
		public ?ColourLabel $colourLabel,
		public Flag $flag,
		public bool $keepRaw,
		public int $takenAt,
		public ?string $cameraModel,
		public AssetKind $kind,
		public string $assetUpdatedAt,
	) {
	}

	/** One decision of a save's body; anything malformed is a bad request (IMMICH-003.5). */
	public static function fromRequest(mixed $raw): self {
		if (!is_array($raw) || array_diff(array_keys($raw), self::KEYS) !== [] || count($raw) !== count(self::KEYS)) {
			throw self::malformed();
		}
		['assetId' => $assetId, 'rating' => $rating, 'colourLabel' => $label, 'flag' => $flag, 'keepRaw' => $keepRaw, 'takenAt' => $takenAt, 'cameraModel' => $model, 'kind' => $kind, 'assetUpdatedAt' => $updatedAt] = $raw;
		if (!is_string($assetId) || preg_match(self::ASSET_ID, $assetId) !== 1
			|| !is_int($rating) || $rating < 0 || $rating > self::MAX_RATING
			|| ($label !== null && !is_string($label)) || !is_string($flag) || !is_bool($keepRaw)
			|| !is_int($takenAt) || $takenAt < 0 || !is_string($kind)
			|| ($model !== null && (!is_string($model) || $model === '' || strlen($model) > self::CAMERA_MODEL_LENGTH))
			|| !is_string($updatedAt) || $updatedAt === '' || strlen($updatedAt) > self::TIME_LENGTH) {
			throw self::malformed();
		}
		return new self(
			$assetId,
			$rating,
			$label === null ? null : (ColourLabel::tryFrom($label) ?? throw self::malformed()),
			Flag::tryFrom($flag) ?? throw self::malformed(),
			$keepRaw,
			$takenAt,
			$model,
			AssetKind::tryFrom($kind) ?? throw self::malformed(),
			$updatedAt,
		);
	}

	private static function malformed(): ImmichException {
		return new ImmichException(ImmichError::Request);
	}
}
