<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Listing;

/** Reads the camera and capture time fields of a TIFF structure; a field it cannot read is left out (ADR 0061). */
final class TiffFields {
	/** The byte order of each header magic: TIFF, Olympus ORF and Panasonic RW2, true for little-endian. */
	private const array MAGICS = ["II*\0" => true, "MM\0*" => false, 'IIRO' => true, 'IIRS' => true, 'MMOR' => false, "IIU\0" => true];
	private const int HEADER = 8;
	private const int ENTRY = 12;
	private const int TYPE_ASCII = 2;
	private const array TYPES_POINTER = [4, 13];
	private const int TAG_EXIF_IFD = 0x8769;
	private const array IFD0_TAGS = [0x010F => 'Make', 0x0110 => 'Model'];
	private const array EXIF_TAGS = [0x9003 => 'DateTimeOriginal', 0x9011 => 'OffsetTimeOriginal'];

	/**
	 * IFD0's Make and Model and its Exif IFD's DateTimeOriginal and OffsetTimeOriginal.
	 * @return array<string, string>
	 */
	public function ofIfd0(string $tiff): array {
		$entries = $this->firstIfd($tiff);
		if ($entries === null) {
			return [];
		}
		$fields = $this->ascii($tiff, $entries, self::IFD0_TAGS);
		$exif = $this->pointer($tiff, $entries[self::TAG_EXIF_IFD] ?? null);
		return $exif === null ? $fields : $fields + $this->ascii($tiff, $this->entries($tiff, $exif), self::EXIF_TAGS);
	}

	/**
	 * DateTimeOriginal and OffsetTimeOriginal of a TIFF whose first IFD is an Exif IFD, as a CR3 `CMT2` box holds.
	 * @return array<string, string>
	 */
	public function ofExifIfd(string $tiff): array {
		$entries = $this->firstIfd($tiff);
		return $entries === null ? [] : $this->ascii($tiff, $entries, self::EXIF_TAGS);
	}

	/** @return ?array<int, array{type: int, count: int, at: int}> the entries of the first IFD, null for no TIFF */
	private function firstIfd(string $tiff): ?array {
		$little = self::MAGICS[substr($tiff, 0, 4)] ?? null;
		if ($little === null || strlen($tiff) < self::HEADER) {
			return null;
		}
		return $this->entries($tiff, $this->u32($tiff, 4));
	}

	/** @return array<int, array{type: int, count: int, at: int}> the complete entries of the IFD at `$offset`, by tag */
	private function entries(string $tiff, ?int $offset): array {
		$count = $offset === null ? null : $this->u16($tiff, $offset);
		$entries = [];
		for ($index = 0; $offset !== null && $count !== null && $index < $count; $index++) {
			$at = $offset + 2 + $index * self::ENTRY;
			if ($at + self::ENTRY > strlen($tiff)) {
				break;
			}
			$entries[(int)$this->u16($tiff, $at)] = ['type' => (int)$this->u16($tiff, $at + 2), 'count' => (int)$this->u32($tiff, $at + 4), 'at' => $at + 8];
		}
		return $entries;
	}

	/**
	 * The non-empty UTF-8 strings of the `$tags` among `$entries`, by field name.
	 * @param array<int, array{type: int, count: int, at: int}> $entries
	 * @param array<int, string> $tags
	 * @return array<string, string>
	 */
	private function ascii(string $tiff, array $entries, array $tags): array {
		$fields = [];
		foreach ($tags as $tag => $name) {
			$entry = $entries[$tag] ?? null;
			if ($entry === null || $entry['type'] !== self::TYPE_ASCII || $entry['count'] === 0) {
				continue;
			}
			$at = $entry['count'] <= 4 ? $entry['at'] : $this->u32($tiff, $entry['at']);
			$bytes = $at === null || $at + $entry['count'] > strlen($tiff) ? '' : substr($tiff, $at, $entry['count']);
			$value = trim(explode("\0", $bytes, 2)[0]);
			if ($value !== '' && mb_check_encoding($value, 'UTF-8')) {
				$fields[$name] = $value;
			}
		}
		return $fields;
	}

	/** @param ?array{type: int, count: int, at: int} $entry the offset an IFD pointer entry holds, null for none */
	private function pointer(string $tiff, ?array $entry): ?int {
		return $entry !== null && in_array($entry['type'], self::TYPES_POINTER, true) ? $this->u32($tiff, $entry['at']) : null;
	}

	private function u16(string $tiff, int $at): ?int {
		return $this->unpack($tiff, $at, 2);
	}

	private function u32(string $tiff, int $at): ?int {
		return $this->unpack($tiff, $at, 4);
	}

	/** The unsigned integer of `$size` bytes at `$at` in the TIFF's byte order, null beyond the end. */
	private function unpack(string $tiff, int $at, int $size): ?int {
		if ($at + $size > strlen($tiff)) {
			return null;
		}
		$little = self::MAGICS[substr($tiff, 0, 4)] ?? true;
		$format = $size === 2 ? ($little ? 'v' : 'n') : ($little ? 'V' : 'N');
		/** @var array{1: int} $value */
		$value = unpack($format, $tiff, $at);
		return $value[1];
	}
}
