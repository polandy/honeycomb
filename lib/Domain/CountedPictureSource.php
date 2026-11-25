<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/**
 * A picture source that counts its listing on the server, as it lists only one page at a time (ADR 0044, ADR 0058).
 *
 * @template TSource
 * @template TQuery
 * @template TListing
 * @template TPicture
 * @template TImage
 * @template TRows
 * @template TSaved
 * @template TCountsQuery what the counts are asked by
 * @template TCounts the counts
 * @template-extends PictureSource<TSource, TQuery, TListing, TPicture, TImage, TRows, TSaved>
 */
interface CountedPictureSource extends PictureSource {
	/**
	 * The counts of the listing the query asks of the source.
	 * @param TSource $source
	 * @param TCountsQuery $query
	 * @return TCounts
	 */
	public function counts(mixed $source, mixed $query): mixed;
}
