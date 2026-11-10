<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Preview;

use OCA\Honeycomb\Preview\EmbeddedJpeg;
use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCP\Files\File;
use OCP\Files\FileInfo;
use OCP\Files\NotPermittedException;
use OCP\IImage;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;

final class RawPreviewProviderTest extends TestCase {
	private const string JPEG = "\xFF\xD8\xFF\xC0\x00\x04ab\xFF\xDA\x00\x04cdscan\xFF\xD9";

	private function provider(?IImage $decoded, ?string &$decodedBytes = null): RawPreviewProvider {
		$decoder = $this->createStub(JpegDecoder::class);
		$decoder->method('decode')->willReturnCallback(static function (string $jpeg) use ($decoded, &$decodedBytes): ?IImage {
			$decodedBytes = $jpeg;
			return $decoded;
		});
		return new RawPreviewProvider(new EmbeddedJpeg(), $decoder);
	}

	private function raw(string $content): File {
		$file = $this->createStub(File::class);
		$file->method('getContent')->willReturn($content);
		return $file;
	}

	public function testClaimsTheRawMimeType(): void {
		$this->assertSame(1, preg_match(RawPreviewProvider::MIME_TYPE_REGEX, 'image/x-dcraw'));
		$this->assertSame(0, preg_match(RawPreviewProvider::MIME_TYPE_REGEX, 'image/jpeg'));
		$this->assertSame(RawPreviewProvider::MIME_TYPE_REGEX, $this->provider(null)->getMimeType());
	}

	public function testIsAvailableForAFileWithContent(): void {
		$empty = $this->createStub(FileInfo::class);
		$empty->method('getSize')->willReturn(0);
		$raw = $this->createStub(FileInfo::class);
		$raw->method('getSize')->willReturn(25_000_000);

		$this->assertTrue($this->provider(null)->isAvailable($raw));
		$this->assertFalse($this->provider(null)->isAvailable($empty));
	}

	public function testScalesTheEmbeddedJpegDownToTheRequestedBox(): void {
		$image = $this->createMock(IImage::class);
		$image->expects($this->once())->method('scaleDownToFit')->with(2048, 1024)->willReturn(true);

		$thumbnail = $this->provider($image, $decodedBytes)->getThumbnail($this->raw("II*\0" . self::JPEG . "\0\0"), 2048, 1024);

		$this->assertSame($image, $thumbnail);
		$this->assertSame(self::JPEG, $decodedBytes);
	}

	public function testHasNoThumbnailWithoutAnEmbeddedJpeg(): void {
		$this->assertNull($this->provider($this->createStub(IImage::class))->getThumbnail($this->raw("II*\0sensor"), 256, 256));
	}

	public function testHasNoThumbnailWhenTheEmbeddedJpegDoesNotDecode(): void {
		$this->assertNull($this->provider(null)->getThumbnail($this->raw(self::JPEG), 256, 256));
	}

	public function testHasNoThumbnailWhenTheRawCannotBeRead(): void {
		$locked = $this->createStub(File::class);
		$locked->method('getContent')->willThrowException(new LockedException('/alice/files/IMG_0001.NEF'));
		$forbidden = $this->createStub(File::class);
		$forbidden->method('getContent')->willThrowException(new NotPermittedException());

		$this->assertNull($this->provider($this->createStub(IImage::class))->getThumbnail($locked, 256, 256));
		$this->assertNull($this->provider($this->createStub(IImage::class))->getThumbnail($forbidden, 256, 256));
	}
}
