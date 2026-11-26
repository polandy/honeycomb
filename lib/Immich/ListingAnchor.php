<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** The asset a listing starts at, for the resume position, with its capture time (IMMICH-002.34). */
final readonly class ListingAnchor {
	public function __construct(
		public string $assetId,
		public int $takenAt,
	) {
	}

	/**
	 * The request's `{assetId, takenAt}`; anything else is a bad request (IMMICH-002.35).
	 * @param array<array-key, mixed> $from
	 */
	public static function fromRequest(array $from): self {
		/** @var mixed $assetId */
		$assetId = $from['assetId'] ?? null;
		/** @var mixed $takenAt */
		$takenAt = $from['takenAt'] ?? null;
		if (!is_string($assetId) || preg_match(AssetDecision::ASSET_ID, $assetId) !== 1 || !is_int($takenAt) || $takenAt < 0) {
			throw new ImmichException(ImmichError::Request);
		}
		return new self($assetId, $takenAt);
	}
}
