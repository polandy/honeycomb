<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

/** Builds the headers of TIFF-based, RAF and CR3 files for the parser tests. */
final class RawBytes {
	public const array TAGS = ['Make' => 0x010F, 'Model' => 0x0110, 'DateTimeOriginal' => 0x9003, 'OffsetTimeOriginal' => 0x9011];
	public const string CANON_UUID = "\x85\xC0\xB6\x87\x82\x0F\x11\xE0\x81\x11\xF4\xCE\x46\x2B\x6A\x48";
	private const int TAG_EXIF_IFD = 0x8769;
	private const int ASCII = 2;
	private const int SHORT = 3;
	private const int LONG = 4;
	private const int HEADER = 8;

	/**
	 * A TIFF with `$ifd0` and, when given, an Exif IFD; a string field is ASCII with a NUL, an int one a SHORT.
	 * @param array<string, string|int> $ifd0
	 * @param array<string, string|int> $exif
	 */
	public static function tiff(array $ifd0, array $exif = [], bool $little = true, ?string $magic = null): string {
		$ifd0Size = self::ifdSize(count($ifd0) + ($exif === [] ? 0 : 1));
		$exifAt = self::HEADER + $ifd0Size;
		$dataAt = $exifAt + ($exif === [] ? 0 : self::ifdSize(count($exif)));
		$data = '';
		$pointer = $exif === [] ? [] : [self::TAG_EXIF_IFD => [self::LONG, 1, self::u32($exifAt, $little)]];
		$first = self::ifd(self::entries($ifd0, $little, $dataAt, $data) + $pointer, $little);
		$second = $exif === [] ? '' : self::ifd(self::entries($exif, $little, $dataAt, $data), $little);
		return ($magic ?? ($little ? "II*\0" : "MM\0*")) . self::u32(self::HEADER, $little) . $first . $second . $data;
	}

	/** A RAF file whose embedded JPEG preview holds `$tiff` in its Exif segment, after `$segmentsBefore`. */
	public static function raf(string $tiff, string $segmentsBefore = ''): string {
		$jpegAt = 100;
		$jpeg = "\xFF\xD8" . $segmentsBefore . self::segment(0xE1, "Exif\0\0" . $tiff) . "\xFF\xDA\x00\x02";
		$header = str_pad('FUJIFILMCCD-RAW 0201FF129502X-T2', 84, "\0") . pack('NN', $jpegAt, strlen($jpeg));
		return str_pad($header, $jpegAt, "\0") . $jpeg;
	}

	/** A JPEG marker segment with its length. */
	public static function segment(int $marker, string $payload): string {
		return "\xFF" . chr($marker) . pack('n', strlen($payload) + 2) . $payload;
	}

	/** A CR3 file with `$cmt1` and `$cmt2` in Canon's `uuid` box of `moov`. */
	public static function cr3(string $cmt1, string $cmt2): string {
		$canon = self::box('uuid', self::CANON_UUID . self::box('CNCV', 'CanonCR3_001/00.09.00/00.00.00') . self::box('CMT1', $cmt1) . self::box('CMT2', $cmt2));
		return self::box('ftyp', "crx \0\0\0\1crx isom") . self::box('moov', self::box('uuid', str_repeat("\0", 16)) . $canon);
	}

	/** An ISO base media box. */
	public static function box(string $type, string $content): string {
		return pack('N', strlen($content) + 8) . $type . $content;
	}

	private static function ifdSize(int $entries): int {
		return 2 + 12 * $entries + 4;
	}

	/**
	 * @param array<string, string|int> $fields
	 * @return array<int, array{int, int, string}> the type, count and value field of each entry, strings over four bytes appended to `$data`
	 */
	private static function entries(array $fields, bool $little, int $dataAt, string &$data): array {
		$entries = [];
		foreach ($fields as $name => $value) {
			if (is_int($value)) {
				$entries[self::TAGS[$name]] = [self::SHORT, 1, str_pad(self::u16($value, $little), 4, "\0")];
				continue;
			}
			$bytes = $value . "\0";
			if (strlen($bytes) <= 4) {
				$entries[self::TAGS[$name]] = [self::ASCII, strlen($bytes), str_pad($bytes, 4, "\0")];
				continue;
			}
			$entries[self::TAGS[$name]] = [self::ASCII, strlen($bytes), self::u32($dataAt + strlen($data), $little)];
			$data .= $bytes;
		}
		return $entries;
	}

	/** @param array<int, array{int, int, string}> $entries */
	private static function ifd(array $entries, bool $little): string {
		ksort($entries);
		$ifd = self::u16(count($entries), $little);
		foreach ($entries as $tag => [$type, $count, $value]) {
			$ifd .= self::u16($tag, $little) . self::u16($type, $little) . self::u32($count, $little) . $value;
		}
		return $ifd . self::u32(0, $little);
	}

	private static function u16(int $value, bool $little): string {
		return pack($little ? 'v' : 'n', $value);
	}

	private static function u32(int $value, bool $little): string {
		return pack($little ? 'V' : 'N', $value);
	}
}
