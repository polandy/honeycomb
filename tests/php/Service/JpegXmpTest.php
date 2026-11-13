<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\JpegXmp;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class JpegXmpTest extends TestCase {
	private const string PACKET = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"/><?xpacket end="w"?>';
	private const string XMP_HEADER = "http://ns.adobe.com/xap/1.0/\x00";

	/** A marker segment with its length. */
	private static function segment(int $marker, string $payload): string {
		return "\xFF" . chr($marker) . pack('n', strlen($payload) + 2) . $payload;
	}

	/** A JPEG of the given segments, then a scan with entropy-coded bytes and the end of image. */
	private static function jpeg(string ...$segments): string {
		return "\xFF\xD8" . implode('', $segments) . self::segment(0xDA, "\x01\x01\x00\x00\x3F\x00") . "\x12\xFF\x00\x34\xFF\xD0\x56" . "\xFF\xD9";
	}

	/** @return array<string, array{string}> */
	public static function withPacket(): array {
		$exif = self::segment(0xE1, "Exif\x00\x00" . str_repeat("\x00", 2000));
		return [
			'after EXIF and an ICC profile' => [self::jpeg($exif, self::segment(0xE2, 'ICC_PROFILE' . str_repeat('i', 500)), self::segment(0xE1, self::XMP_HEADER . self::PACKET))],
			'alone, after fill bytes and a restart marker' => [self::jpeg("\xFF\xD0", "\xFF\xFF" . substr(self::segment(0xE1, self::XMP_HEADER . self::PACKET), 1))],
		];
	}

	// spec: XMP-005.1
	#[DataProvider('withPacket')]
	public function testAnswersThePacketOfTheFirstXmpSegment(string $jpeg): void {
		$this->assertSame(self::PACKET, (new JpegXmp())->packet(MemoryStream::of($jpeg)));
	}

	/** @return array<string, array{string}> */
	public static function withoutPacket(): array {
		$xmp = self::segment(0xE1, self::XMP_HEADER . self::PACKET);
		return [
			'no XMP' => [self::jpeg(self::segment(0xE1, "Exif\x00\x00abc"))],
			'only Extended XMP' => [self::jpeg(self::segment(0xE1, "http://ns.adobe.com/xmp/extension/\x00" . self::PACKET))],
			'XMP after the start of scan' => ["\xFF\xD8" . self::segment(0xDA, "\x01") . "\x00" . $xmp . "\xFF\xD9"],
			'cut off in a segment' => [substr(self::jpeg($xmp), 0, 40)],
			'cut off in a length' => ["\xFF\xD8\xFF\xE1\x00"],
			'a length below its own size' => ["\xFF\xD8\xFF\xE1\x00\x01" . self::XMP_HEADER],
			'no marker where one belongs' => ["\xFF\xD8\x00" . $xmp],
			'not a JPEG' => ["\x89PNG\r\n\x1A\n" . $xmp],
			'empty' => [''],
			'ends after the start of image' => ["\xFF\xD8"],
			'ends in fill bytes' => ["\xFF\xD8\xFF\xFF"],
			'end of image before any scan' => ["\xFF\xD8\xFF\xD9" . $xmp],
		];
	}

	// spec: XMP-005.2
	#[DataProvider('withoutPacket')]
	public function testAnswersNullWithoutAPacketBeforeTheImageData(string $bytes): void {
		$this->assertNull((new JpegXmp())->packet(MemoryStream::of($bytes)));
	}
}
