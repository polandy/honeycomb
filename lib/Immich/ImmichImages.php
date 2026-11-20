<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Proxies Immich's rendered images of an asset (IMMICH-002.16). */
final class ImmichImages {
	private const array SIZES = ['thumbnail', 'preview'];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
	) {
	}

	/**
	 * The asset's image in the size; another size or an id that is no asset id is a bad request.
	 * @return array{body: string, type: string}
	 */
	public function image(Connection $connection, string $assetId, string $size): array {
		if (!in_array($size, self::SIZES, true) || preg_match(AssetDecision::ASSET_ID, $assetId) !== 1) {
			throw new ImmichException(ImmichError::Request);
		}
		return $this->client->thumbnail($connection, $assetId, $size);
	}
}
