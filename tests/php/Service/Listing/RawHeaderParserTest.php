<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use OCA\Honeycomb\Service\Listing\RawHeaderParser;
use OCA\Honeycomb\Service\Listing\TiffFields;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RawHeaderParserTest extends TestCase {
	private const string FIXTURES = __DIR__ . '/../../../fixtures/raw-headers/';
	private const array CAMERA = ['Make' => 'NIKON CORPORATION', 'Model' => 'NIKON Z 6_2'];
	private const array TIME = ['DateTimeOriginal' => '2026:11:25 14:03:09', 'OffsetTimeOriginal' => '+01:00'];

	/** @return array<string, string> */
	private function fields(string $bytes): array {
		return (new RawHeaderParser(new TiffFields()))->fields($bytes);
	}

	/** @psalm-suppress ForbiddenCode Reads a test fixture, not a user file. */
	private static function fixture(string $name): string {
		return (string)file_get_contents(self::FIXTURES . $name);
	}

	/** @return array<string, array{string, array<string, string>}> each fixture cut from a camera's file and its header values */
	public static function cameraFiles(): array {
		return [
			'Canon CR2' => ['canon-eos-7d.cr2', ['Make' => 'Canon', 'Model' => 'Canon EOS 7D', 'DateTimeOriginal' => '2015:06:23 19:37:48']],
			'Sony ARW' => ['sony-ilce-7rm2.arw', ['Make' => 'SONY', 'Model' => 'ILCE-7RM2', 'DateTimeOriginal' => '2017:04:14 13:45:34']],
			'Canon DNG' => ['canon-eos-7d.dng', ['Make' => 'Canon', 'Model' => 'Canon EOS 7D', 'DateTimeOriginal' => '2015:08:03 07:26:52']],
			'DJI DNG' => ['dji-fc3582.dng', ['Make' => 'DJI', 'Model' => 'FC3582', 'DateTimeOriginal' => '2023:09:27 15:30:36']],
			'Fujifilm RAF' => ['fujifilm-x-t2.raf', ['Make' => 'FUJIFILM', 'Model' => 'X-T2', 'DateTimeOriginal' => '2020:02:28 19:55:15']],
			'Fujifilm RAF with an offset' => ['fujifilm-x-t5.raf', ['Make' => 'FUJIFILM', 'Model' => 'X-T5', 'DateTimeOriginal' => '2025:04:17 15:53:11', 'OffsetTimeOriginal' => '+01:00']],
		];
	}

	/** @param array<string, string> $expected */
	// spec: LISTING-004.1, LISTING-004.2
	#[DataProvider('cameraFiles')]
	public function testReadsTheHeaderOfACamerasFile(string $fixture, array $expected): void {
		$fields = $this->fields(self::fixture($fixture));
		ksort($fields);
		ksort($expected);

		$this->assertSame($expected, $fields);
	}

	/** @return array<string, array{bool, ?string}> the byte order and header magic of each TIFF-based format */
	public static function tiffFormats(): array {
		return [
			'NEF, PEF, SRW, little-endian' => [true, null],
			'NEF, big-endian' => [false, null],
			'ORF' => [true, 'IIRO'],
			'ORF, IIRS' => [true, 'IIRS'],
			'ORF, big-endian' => [false, 'MMOR'],
			'RW2' => [true, "IIU\0"],
		];
	}

	// spec: LISTING-004.1
	#[DataProvider('tiffFormats')]
	public function testReadsEveryTiffBasedFormatInBothByteOrders(bool $little, ?string $magic): void {
		$this->assertSame(self::CAMERA + self::TIME, $this->fields(RawBytes::tiff(self::CAMERA, self::TIME, $little, $magic)));
	}

	// spec: LISTING-004.1
	public function testReadsValuesOfUpToFourBytesFromTheEntryItself(): void {
		$this->assertSame(['Make' => 'DJI', 'Model' => 'X'], $this->fields(RawBytes::tiff(['Make' => 'DJI', 'Model' => 'X'])));
	}

	// spec: LISTING-004.1
	public function testFollowsAnExifIfdPointerOfTypeIfd(): void {
		$tiff = str_replace(pack('vvV', 0x8769, 4, 1), pack('vvV', 0x8769, 13, 1), RawBytes::tiff(self::CAMERA, self::TIME));

		$this->assertSame(self::CAMERA + self::TIME, $this->fields($tiff));
	}

	// spec: LISTING-004.2
	public function testReadsNoValueBeyondTheRafExifSegment(): void {
		$tiff = RawBytes::tiff(['Make' => 'NIKON CORPORATION']);
		$cut = 6;
		$raf = RawBytes::raf(substr($tiff, 0, -$cut));

		$this->assertSame([], $this->fields(str_replace("\xFF\xDA", substr($tiff, -$cut) . "\xFF\xDA", $raf)));
	}

	// spec: LISTING-004.2
	public function testFindsTheExifSegmentOfARafPreviewAfterOtherSegments(): void {
		$raf = RawBytes::raf(RawBytes::tiff(self::CAMERA, self::TIME), RawBytes::segment(0xE0, "JFIF\0\1\1") . RawBytes::segment(0xE1, 'http://ns.adobe.com/xap/1.0/'));

		$this->assertSame(self::CAMERA + self::TIME, $this->fields($raf));
	}

	// spec: LISTING-004.3
	public function testReadsTheCanonBoxesOfACr3(): void {
		$cr3 = RawBytes::cr3(RawBytes::tiff(self::CAMERA), RawBytes::tiff(self::TIME, [], false));

		$this->assertSame(['Make' => 'NIKON CORPORATION', 'Model' => 'NIKON Z 6_2'] + self::TIME, $this->fields($cr3));
	}

	// spec: LISTING-004.3
	public function testReadsTheFirstOfTwoBoxesOfOneType(): void {
		$cmt = RawBytes::box('CMT1', RawBytes::tiff(self::CAMERA)) . RawBytes::box('CMT1', RawBytes::tiff(['Make' => 'Canon']));
		$cr3 = RawBytes::box('ftyp', 'crx ') . RawBytes::box('moov', RawBytes::box('uuid', RawBytes::CANON_UUID . $cmt));

		$this->assertSame(self::CAMERA, $this->fields($cr3));
	}

	// spec: LISTING-004.3
	public function testReadsACr3WhoseLastBoxRunsToTheEndOrHasALargeSize(): void {
		$cmt = RawBytes::box('CMT1', RawBytes::tiff(self::CAMERA));
		$large = pack('N', 1) . 'CMT2' . pack('J', strlen(RawBytes::tiff(self::TIME)) + 16) . RawBytes::tiff(self::TIME);
		$canon = RawBytes::box('uuid', RawBytes::CANON_UUID . $cmt . $large);
		$cr3 = RawBytes::box('ftyp', 'crx ') . pack('N', 0) . 'moov' . $canon;

		$this->assertSame(self::CAMERA + self::TIME, $this->fields($cr3));
	}

	/** @return array<string, array{array<string, string|int>, array<string, string>}> the IFD0 fields written and those read */
	public static function oddValues(): array {
		return [
			'none' => [[], []],
			'an empty make' => [['Make' => '', 'Model' => 'X-T5'], ['Model' => 'X-T5']],
			'NUL and space padding' => [['Make' => "  Canon \0\0\0", 'Model' => "EOS R5\0junk"], ['Make' => 'Canon', 'Model' => 'EOS R5']],
			'a make that is not text' => [['Make' => 7, 'Model' => 'X-T5'], ['Model' => 'X-T5']],
			'a model that is not UTF-8' => [['Make' => 'Canon', 'Model' => "EOS \xFF\xFE"], ['Make' => 'Canon']],
		];
	}

	/**
	 * @param array<string, string|int> $ifd0
	 * @param array<string, string> $expected
	 */
	// spec: LISTING-004.5
	#[DataProvider('oddValues')]
	public function testLeavesOutAbsentEmptyAndInvalidValues(array $ifd0, array $expected): void {
		$this->assertSame($expected, $this->fields(RawBytes::tiff($ifd0)));
	}

	/** @return array<string, array{string}> files of other formats and malformed headers */
	public static function malformed(): array {
		$tiff = RawBytes::tiff(self::CAMERA, self::TIME);
		$outside = "II*\0" . pack('V', 0xFFFF_FFF0);
		$make = RawBytes::tiff(['Make' => 'NIKON CORPORATION']);
		return [
			'an empty file' => [''],
			'a JPEG' => ["\xFF\xD8\xFF\xE0" . str_repeat("\0", 64)],
			'only a TIFF magic' => ["II*\0"],
			'an IFD0 outside the file' => [$outside],
			'a string outside the file' => [substr($make, 0, 18) . pack('V', 0x7FFF_FFFF) . substr($make, 22)],
			'a RAF cut in its header' => [substr(RawBytes::raf($tiff), 0, 86)],
			'a RAF preview outside the file' => [str_pad('FUJIFILMCCD-RAW ', 84, "\0") . pack('N', 0x7FFF_FFFF)],
			'a RAF preview that is no JPEG' => [str_pad('FUJIFILMCCD-RAW ', 84, "\0") . pack('N', 88) . 'GIF8'],
			'a RAF preview with a segment of length zero' => [str_pad('FUJIFILMCCD-RAW ', 84, "\0") . pack('N', 88) . "\xFF\xD8\xFF\xE0\x00\x00"],
			'a RAF preview without an Exif segment' => [str_pad('FUJIFILMCCD-RAW ', 84, "\0") . pack('N', 88) . "\xFF\xD8\xFF\xDA\x00\x02"],
			'a CR3 without moov' => [RawBytes::box('ftyp', 'crx ')],
			'a CR3 without the Canon box' => [RawBytes::box('ftyp', 'crx ') . RawBytes::box('moov', RawBytes::box('uuid', str_repeat("\0", 16)))],
			'a CR3 with a box shorter than its header' => [RawBytes::box('ftyp', 'crx ') . pack('N', 4) . 'moov'],
			'a CR3 with a huge large size' => [RawBytes::box('ftyp', 'crx ') . pack('N', 1) . 'moov' . pack('J', -1)],
		];
	}

	// spec: LISTING-004.6
	#[DataProvider('malformed')]
	public function testReadsNothingFromAnotherFormatOrAMalformedHeader(string $bytes): void {
		$this->assertSame([], $this->fields($bytes));
	}

	/** @return array<string, array{string}> */
	public static function allFixtures(): array {
		return array_map(static fn (array $file): array => [$file[0]], self::cameraFiles()) + ['CR3' => ['']];
	}

	// spec: LISTING-004.6
	#[DataProvider('allFixtures')]
	public function testReadsATruncatedHeaderWithoutFailingAndOnlyItsOwnValues(string $fixture): void {
		$bytes = $fixture === '' ? RawBytes::cr3(RawBytes::tiff(self::CAMERA), RawBytes::tiff(self::TIME)) : self::fixture($fixture);
		$complete = $this->fields($bytes);

		for ($length = 0; $length < strlen($bytes); $length += max(1, intdiv(strlen($bytes), 400))) {
			$fields = $this->fields(substr($bytes, 0, $length));
			$this->assertSame(array_intersect_assoc($fields, $complete), $fields, "cut at $length");
		}
		$this->assertNotSame([], $complete);
	}
}
