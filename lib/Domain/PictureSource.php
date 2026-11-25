<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/**
 * What a cull route asks of one kind of picture source; a new kind is one more class (ADR 0058).
 *
 * @template TSource what names the source: the user for their folders, the connection for Immich
 * @template TQuery what a listing is asked by
 * @template TListing a listing or one page of it
 * @template TPicture what names one picture's image in a size
 * @template TImage that image
 * @template TRows the decision rows a save is sent
 * @template TSaved what a save answers
 */
interface PictureSource {
	/**
	 * The listing the query asks of the source.
	 * @param TSource $source
	 * @param TQuery $query
	 * @return TListing
	 */
	public function listing(mixed $source, mixed $query): mixed;

	/**
	 * The picture's image.
	 * @param TSource $source
	 * @param TPicture $picture
	 * @return TImage
	 */
	public function image(mixed $source, mixed $picture): mixed;

	/**
	 * Saves the decision rows and answers what the source made of them.
	 * @param TSource $source
	 * @param TRows $rows
	 * @return TSaved
	 */
	public function decide(mixed $source, mixed $rows): mixed;
}
