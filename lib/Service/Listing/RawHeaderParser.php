<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Listing;

/** Finds the camera and capture time fields in the first bytes of a TIFF-based, RAF or CR3 RAW file (ADR 0061). */
final class RawHeaderParser {
	private const string RAF_MAGIC = 'FUJIFILMCCD-RAW ';
	/** Where a RAF header holds the big-endian offset of its embedded JPEG preview. */
	private const int RAF_PREVIEW_OFFSET = 84;
	private const string JPEG_START = "\xFF\xD8";
	private const int JPEG_APP1 = 0xE1;
	private const int JPEG_START_OF_SCAN = 0xDA;
	private const string EXIF_HEADER = "Exif\0\0";
	/** The `ftyp` box with Canon's CR3 brand, at the start of a CR3 file. */
	private const string CR3_BRAND = 'ftypcrx ';
	/** The `uuid` box of `moov` that holds Canon's metadata boxes. */
	private const string CANON_UUID = "\x85\xC0\xB6\x87\x82\x0F\x11\xE0\x81\x11\xF4\xCE\x46\x2B\x6A\x48";
	private const int BOX_HEADER = 8;
	private const int LARGE_BOX_HEADER = 16;

	public function __construct(
		private TiffFields $tiff,
	) {
	}

	/**
	 * Make, Model, DateTimeOriginal and OffsetTimeOriginal as the header holds them; none for another format or a malformed header.
	 * @return array<string, string>
	 */
	public function fields(string $bytes): array {
		if (str_starts_with($bytes, self::RAF_MAGIC)) {
			return $this->raf($bytes);
		}
		if (substr($bytes, 4, strlen(self::CR3_BRAND)) === self::CR3_BRAND) {
			return $this->cr3($bytes);
		}
		return $this->tiff->ofIfd0($bytes);
	}

	/** @return array<string, string> the fields of the Exif segment of the RAF's embedded JPEG preview */
	private function raf(string $bytes): array {
		$offset = strlen($bytes) >= self::RAF_PREVIEW_OFFSET + 4 ? self::uint('N', $bytes, self::RAF_PREVIEW_OFFSET) : null;
		$jpeg = is_int($offset) ? substr($bytes, $offset) : '';
		if (!str_starts_with($jpeg, self::JPEG_START)) {
			return [];
		}
		$position = strlen(self::JPEG_START);
		while ($position + 4 <= strlen($jpeg) && $jpeg[$position] === "\xFF" && ord($jpeg[$position + 1]) !== self::JPEG_START_OF_SCAN) {
			$length = self::uint('n', $jpeg, $position + 2);
			if (ord($jpeg[$position + 1]) === self::JPEG_APP1 && substr($jpeg, $position + 4, strlen(self::EXIF_HEADER)) === self::EXIF_HEADER) {
				return $this->tiff->ofIfd0(substr($jpeg, $position + 4 + strlen(self::EXIF_HEADER), max(0, $length - 2 - strlen(self::EXIF_HEADER))));
			}
			$position += 2 + $length;
		}
		return [];
	}

	/** @return array<string, string> the fields of the `CMT1` (IFD0) and `CMT2` (Exif IFD) boxes in Canon's `uuid` box of `moov` */
	private function cr3(string $bytes): array {
		$moov = $this->boxes($bytes)['moov'] ?? null;
		$canon = null;
		foreach ($moov === null ? [] : $this->boxList($moov) as [$type, $content]) {
			if ($type === 'uuid' && str_starts_with($content, self::CANON_UUID)) {
				$canon = $this->boxes(substr($content, strlen(self::CANON_UUID)));
				break;
			}
		}
		if ($canon === null) {
			return [];
		}
		return $this->tiff->ofIfd0($canon['CMT1'] ?? '') + $this->tiff->ofExifIfd($canon['CMT2'] ?? '');
	}

	/** @return array<string, string> the content of the first box of each type in `$bytes` */
	private function boxes(string $bytes): array {
		$boxes = [];
		foreach ($this->boxList($bytes) as [$type, $content]) {
			$boxes[$type] ??= $content;
		}
		return $boxes;
	}

	/** @return list<array{string, string}> the type and content of each box in `$bytes`, the last one cut at the end */
	private function boxList(string $bytes): array {
		$boxes = [];
		$position = 0;
		while ($position + self::BOX_HEADER <= strlen($bytes)) {
			$size = self::uint('N', $bytes, $position);
			$header = self::BOX_HEADER;
			if ($size === 1 && $position + self::LARGE_BOX_HEADER <= strlen($bytes)) {
				$size = self::uint('J', $bytes, $position + self::BOX_HEADER);
				$header = self::LARGE_BOX_HEADER;
			} elseif ($size === 0) {
				$size = strlen($bytes) - $position;
			}
			if ($size < $header) {
				break;
			}
			$boxes[] = [substr($bytes, $position + 4, 4), substr($bytes, $position + $header, $size - $header)];
			$position += $size;
		}
		return $boxes;
	}

	/** The unsigned integer of the `unpack` `$format` at `$at`, which the caller checked lies within `$bytes`. */
	private static function uint(string $format, string $bytes, int $at): int {
		/** @var array{1: int} $value */
		$value = unpack($format, $bytes, $at);
		return $value[1];
	}
}
