<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Listing;

use DateTimeImmutable;
use DateTimeZone;
use OCP\FilesMetadata\Exceptions\FilesMetadataException;
use OCP\FilesMetadata\Model\IFilesMetadata;

/** The value honeycomb stores in a RAW file's metadata: its capture time and camera, as Photos computes them for a JPEG (ADR 0061). */
final class RawExif {
	/** The file metadata key; its presence means the file was read. */
	public const string KEY = 'honeycomb-raw_exif';
	/** The format of an Exif date and time. */
	private const string EXIF_TIME = 'Y:m:d H:i:s';
	/** An Exif time offset such as `+02:00`, within the range a time zone accepts. */
	private const string OFFSET = '/^[+-](0\d|1[0-4]):[0-5]\d$/';

	/**
	 * The stored value of the header `$fields`, the time in `$offset`'s zone or else in `$zone`, each value only when the header has it.
	 * @param array<string, string> $fields
	 * @return array{DateTimeOriginal?: int, Make?: string, Model?: string}
	 */
	public static function of(array $fields, DateTimeZone $zone): array {
		$value = [];
		$time = self::time($fields['DateTimeOriginal'] ?? null, $fields['OffsetTimeOriginal'] ?? null, $zone);
		if ($time !== null) {
			$value['DateTimeOriginal'] = $time;
		}
		foreach (['Make', 'Model'] as $name) {
			if (isset($fields[$name])) {
				$value[$name] = $fields[$name];
			}
		}
		return $value;
	}

	/**
	 * The value stored in `$metadata`, each field only when it has its type; empty without the key.
	 * @return array{DateTimeOriginal?: int, Make?: string, Model?: string}
	 */
	public static function in(?IFilesMetadata $metadata): array {
		try {
			$stored = $metadata?->getArray(self::KEY) ?? [];
		} catch (FilesMetadataException) {
			return [];
		}
		$value = [];
		$time = $stored['DateTimeOriginal'] ?? null;
		if (is_int($time)) {
			$value['DateTimeOriginal'] = $time;
		}
		foreach (['Make', 'Model'] as $name) {
			$text = $stored[$name] ?? null;
			if (is_string($text)) {
				$value[$name] = $text;
			}
		}
		return $value;
	}

	/** The Unix seconds of an Exif date and time, null for none or one that is no real date such as `0000:00:00 00:00:00`. */
	private static function time(?string $dateTime, ?string $offset, DateTimeZone $zone): ?int {
		if ($dateTime === null) {
			return null;
		}
		$parsed = DateTimeImmutable::createFromFormat('!' . self::EXIF_TIME, $dateTime, self::zone($offset) ?? $zone);
		return $parsed !== false && $parsed->format(self::EXIF_TIME) === $dateTime ? $parsed->getTimestamp() : null;
	}

	/** The zone of an Exif offset such as `+02:00`, null for none or a malformed one. */
	private static function zone(?string $offset): ?DateTimeZone {
		if ($offset === null || $offset === '' || preg_match(self::OFFSET, $offset) !== 1) {
			return null;
		}
		return new DateTimeZone($offset);
	}
}
