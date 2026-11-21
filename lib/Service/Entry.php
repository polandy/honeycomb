<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** One file of the listing with the EXIF basics Nextcloud has extracted and its flag row, `null` where it has none. */
final class Entry implements \JsonSerializable {
	public function __construct(
		private int $fileId,
		private string $path,
		private int $size,
		private int $mtime,
		private string $etag,
		private string $mime,
		private ?int $captureTime,
		private ?int $orientation,
		private ?int $width,
		private ?int $height,
		private ?string $camera,
		private ?string $visualHash,
		private ?QualityValue $quality,
		private ?Exposure $exposure,
		private ?FileFlag $flag,
	) {
	}

	/** @return array<string, int|string|bool|array{method: int, sharpness: float, focusTile: int}|array{exposureTime: ?float, focalLength: ?float, focalLength35: ?float, aperture: ?float, iso: ?int}|null> */
	#[\Override]
	public function jsonSerialize(): array {
		return [
			'fileId' => $this->fileId,
			'path' => $this->path,
			'size' => $this->size,
			'mtime' => $this->mtime,
			'etag' => $this->etag,
			'mime' => $this->mime,
			'captureTime' => $this->captureTime,
			'orientation' => $this->orientation,
			'width' => $this->width,
			'height' => $this->height,
			'camera' => $this->camera,
			'visualHash' => $this->visualHash,
			'quality' => $this->quality?->listed(),
			'exposure' => $this->exposure?->jsonSerialize(),
			'flag' => $this->flag?->flag->value,
			'keepRaw' => $this->flag?->keepRaw,
			'flagUpdated' => $this->flag?->updatedAt,
		];
	}
}
