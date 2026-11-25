<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Domain\CountedPictureSource;

/**
 * One Immich connection's uploads as a picture source: paged and counted on the server (ADR 0044, ADR 0058).
 *
 * @psalm-import-type Entry from AssetEntries
 * @psalm-import-type Counts from ImmichCounts
 * @psalm-type Query = array{filters: array<array-key, mixed>, cursor: ?string, size: int}
 * @psalm-type CountsQuery = array{filters: array<array-key, mixed>, periods: array<array-key, mixed>}
 * @psalm-type Picture = array{assetId: string, size: string}
 * @psalm-type Page = array{entries: list<Entry>, nextCursor: ?string, previousCursor: null}
 * @template-implements CountedPictureSource<Connection, Query, Page, Picture, array{body: string, type: string}, mixed, array{saved: list<string>}, CountsQuery, Counts>
 */
final class ImmichPictureSource implements CountedPictureSource {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichListing $listing,
		private ImmichCounts $counts,
		private ImmichImages $images,
		private ImmichDecisions $decisions,
	) {
	}

	/** One page of the connection's uploads that pass the filters (IMMICH-002.1). */
	#[\Override]
	public function listing(mixed $source, mixed $query): array {
		return $this->listing->page($source, $query['filters'], $query['cursor'], $query['size']);
	}

	/** The server's numbers for the toolbar, the flag chips and each filter option (IMMICH-002.13). */
	#[\Override]
	public function counts(mixed $source, mixed $query): array {
		return $this->counts->of($source, $query['filters'], $query['periods']);
	}

	/** Immich's thumbnail or preview of the asset (IMMICH-002.16). */
	#[\Override]
	public function image(mixed $source, mixed $picture): array {
		return $this->images->image($source, $picture['assetId'], $picture['size']);
	}

	/** Saves the whole decision of each asset under the connection, without asking Immich (IMMICH-003.1). */
	#[\Override]
	public function decide(mixed $source, mixed $rows): array {
		return $this->decisions->save($source, $rows);
	}
}
