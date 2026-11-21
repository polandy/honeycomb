<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The EXIF exposure facts Nextcloud extracted for one file, each `null` where it has none (ADR 0046). */
final readonly class Exposure implements \JsonSerializable {
	public function __construct(
		private ?float $exposureTime,
		private ?float $focalLength,
		private ?float $focalLength35,
		private ?float $aperture,
		private ?int $iso,
	) {
	}

	/**
	 * The facts of Nextcloud's `photos-exif` array, `null` when it holds none of them.
	 * @param array<array-key, mixed> $exif
	 */
	public static function fromExif(array $exif): ?self {
		$exposure = new self(
			self::positive($exif['ExposureTime'] ?? null),
			self::positive($exif['FocalLength'] ?? null),
			self::positive($exif['FocalLengthIn35mmFilm'] ?? null),
			self::positive($exif['FNumber'] ?? null),
			self::wholeNumber(self::positive($exif['ISOSpeedRatings'] ?? null)),
		);
		return $exposure->exposureTime === null && $exposure->focalLength === null && $exposure->focalLength35 === null && $exposure->aperture === null && $exposure->iso === null
			? null
			: $exposure;
	}

	/** @return array{exposureTime: ?float, focalLength: ?float, focalLength35: ?float, aperture: ?float, iso: ?int} */
	#[\Override]
	public function jsonSerialize(): array {
		return [
			'exposureTime' => $this->exposureTime,
			'focalLength' => $this->focalLength,
			'focalLength35' => $this->focalLength35,
			'aperture' => $this->aperture,
			'iso' => $this->iso,
		];
	}

	/** A number above zero from a number, a numeric string or an EXIF rational such as `1/15`; else `null`. */
	private static function positive(mixed $value): ?float {
		if (is_string($value) && preg_match('~^(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)$~', trim($value), $parts) === 1) {
			$value = (float)$parts[2] > 0.0 ? (float)$parts[1] / (float)$parts[2] : null;
		} elseif (is_string($value) && is_numeric($value)) {
			$value = (float)$value;
		}
		return (is_int($value) || is_float($value)) && is_finite((float)$value) && $value > 0 ? (float)$value : null;
	}

	private static function wholeNumber(?float $value): ?int {
		return $value === null ? null : (int)round($value);
	}
}
