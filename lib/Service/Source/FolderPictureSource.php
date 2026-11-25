<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Source;

use OCA\Honeycomb\Domain\PictureSource;
use OCA\Honeycomb\Service\Decision\FlagAnswer;
use OCA\Honeycomb\Service\Decision\FlagService;
use OCA\Honeycomb\Service\Image\ImageService;
use OCA\Honeycomb\Service\Listing\Listing;
use OCA\Honeycomb\Service\Listing\ListingService;
use OCP\Files\File;
use OCP\Files\SimpleFS\ISimpleFile;
use OCP\IUser;

/**
 * The user's Nextcloud folders as a picture source: one folder's whole listing, counted in the browser (ADR 0058).
 *
 * @psalm-type Query = array{path: string, subfolders: bool, excluded: list<string>}
 * @psalm-type Picture = array{file: File, size: int}
 * @template-implements PictureSource<IUser, Query, Listing, Picture, File|ISimpleFile, array<array-key, mixed>, FlagAnswer>
 */
final class FolderPictureSource implements PictureSource {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ListingService $listings,
		private ImageService $images,
		private FlagService $flags,
	) {
	}

	/** The entries of the folder, with subfolders of every folder below but the excluded ones. */
	#[\Override]
	public function listing(mixed $source, mixed $query): Listing {
		return $this->listings->list($source, $query['path'], $query['subfolders'], $query['excluded']);
	}

	/** The preview tier of the file the user may read, or the full image for tier 0. */
	#[\Override]
	public function image(mixed $source, mixed $picture): File|ISimpleFile {
		return $picture['size'] === ImageService::FULL ? $this->images->full($picture['file']) : $this->images->preview($picture['file'], $picture['size']);
	}

	/** Writes the whole flag states of the files the user may flag (ADR 0040). */
	#[\Override]
	public function decide(mixed $source, mixed $rows): FlagAnswer {
		return $this->flags->save($source, $rows);
	}
}
