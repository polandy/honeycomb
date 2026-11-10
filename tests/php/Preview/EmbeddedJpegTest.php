<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Preview;

use OCA\Honeycomb\Preview\EmbeddedJpeg;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class EmbeddedJpegTest extends TestCase {
	private const int SOF_BASELINE = 0xC0;
	private const int SOF_PROGRESSIVE = 0xC2;
	private const int SOF_LOSSLESS = 0xC3;

	private static function segment(int $marker, string $payload): string {
		return "\xFF" . chr($marker) . pack('n', strlen($payload) + 2) . $payload;
	}

	/** A JPEG whose structure the extractor walks; `$scan` is the entropy-coded data. */
	private static function jpeg(string $scan = 'pixels', int $sof = self::SOF_BASELINE, string $app1 = 'Exif'): string {
		return "\xFF\xD8" . self::segment(0xE1, $app1) . self::segment($sof, 'frame') . self::segment(0xDA, 'scan') . $scan . "\xFF\xD9";
	}

	private static function raw(string ...$parts): string {
		return "II*\0" . implode("\0\x11\x22", $parts) . "\x33\x44";
	}

	// spec: IMAGES-001.6
	public function testFindsTheJpegEmbeddedInARaw(): void {
		$jpeg = self::jpeg();

		$this->assertSame($jpeg, (new EmbeddedJpeg())->largest(self::raw($jpeg)));
	}

	// spec: IMAGES-001.6
	public function testPicksTheLargestOfSeveralJpegs(): void {
		$small = self::jpeg('small');
		$large = self::jpeg(str_repeat('large', 100), self::SOF_PROGRESSIVE);

		$this->assertSame($large, (new EmbeddedJpeg())->largest(self::raw($small, $large, self::jpeg('medium'))));
	}

	// spec: IMAGES-001.6
	public function testReturnsTheOuterJpegRatherThanTheThumbnailInItsExifSegment(): void {
		$outer = self::jpeg('outer', app1: 'Exif' . self::jpeg('a thumbnail larger than the outer scan'));

		$this->assertSame($outer, (new EmbeddedJpeg())->largest(self::raw($outer)));
	}

	// spec: IMAGES-001.6
	public function testReadsPastStuffedBytesAndRestartMarkersInTheScan(): void {
		$jpeg = self::jpeg("ab\xFF\x00cd\xFF\xD0ef\xFF\xD7gh");

		$this->assertSame($jpeg, (new EmbeddedJpeg())->largest(self::raw($jpeg)));
	}

	// spec: IMAGES-001.6
	public function testSkipsFillBytesBetweenSegments(): void {
		$jpeg = "\xFF\xD8\xFF" . self::segment(self::SOF_BASELINE, 'frame') . self::segment(0xDA, 'scan') . "x\xFF\xFF\xD9";

		$this->assertSame($jpeg, (new EmbeddedJpeg())->largest(self::raw($jpeg)));
	}

	// spec: IMAGES-001.6
	public function testIgnoresLosslessSensorDataLargerThanThePreview(): void {
		$preview = self::jpeg('preview');
		$sensorData = self::jpeg(str_repeat('sensor', 100), self::SOF_LOSSLESS);

		$this->assertSame($preview, (new EmbeddedJpeg())->largest(self::raw($sensorData, $preview)));
	}

	/** @return array<string, array{string}> */
	public static function withoutACompleteJpeg(): array {
		$jpeg = self::jpeg();
		return [
			'no JPEG' => [self::raw('sensor data')],
			'empty file' => [''],
			'cut off in the scan' => [substr($jpeg, 0, -2)],
			'cut off in a segment header' => [substr($jpeg, 0, 5)],
			'cut off in the scan header' => ["\xFF\xD8" . self::segment(self::SOF_BASELINE, 'frame') . "\xFF\xDA\x00\x10"],
			'segment length below two' => ["\xFF\xD8\xFF\xE1\x00\x01\xFF\xD9"],
			'garbage after the start marker' => ["\xFF\xD8\xFFgarbage"],
			'no scan' => ["\xFF\xD8" . self::segment(self::SOF_BASELINE, 'frame') . "\xFF\xD9"],
			'no frame' => ["\xFF\xD8" . self::segment(0xDA, 'scan') . "x\xFF\xD9"],
		];
	}

	// spec: IMAGES-001.7
	#[DataProvider('withoutACompleteJpeg')]
	public function testFindsNothingWithoutACompleteJpeg(string $bytes): void {
		$this->assertNull((new EmbeddedJpeg())->largest($bytes));
	}
}
