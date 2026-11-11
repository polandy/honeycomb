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

	private function fileInfo(string $name, string $mime, int $size): FileInfo {
		$file = $this->createStub(FileInfo::class);
		$file->method('getName')->willReturn($name);
		$file->method('getMimetype')->willReturn($mime);
		$file->method('getSize')->willReturn($size);
		return $file;
	}

	// spec: IMAGES-001.6
	public function testClaimsTheRawMimeType(): void {
		$this->assertSame(1, preg_match(RawPreviewProvider::MIME_TYPE_REGEX, 'image/x-dcraw'));
		$this->assertSame(0, preg_match(RawPreviewProvider::MIME_TYPE_REGEX, 'image/jpeg'));
		// spec: IMAGES-001.13
		$this->assertSame(1, preg_match(RawPreviewProvider::MIME_TYPE_REGEX, 'application/octet-stream'));
		$this->assertSame(RawPreviewProvider::MIME_TYPE_REGEX, $this->provider(null)->getMimeType());
	}

	// spec: IMAGES-001.6
	public function testIsAvailableForAFileWithContent(): void {
		$empty = $this->fileInfo('IMG_0001.NEF', 'image/x-dcraw', 0);
		$raw = $this->fileInfo('IMG_0001.NEF', 'image/x-dcraw', 25_000_000);

		$this->assertTrue($this->provider(null)->isAvailable($raw));
		$this->assertFalse($this->provider(null)->isAvailable($empty));
	}

	// spec: IMAGES-001.13
	public function testIsAvailableForARawFileNextcloudDoesNotTypeByName(): void {
		$this->assertTrue($this->provider(null)->isAvailable($this->fileInfo('IMG_0001.CR3', 'application/octet-stream', 25_000_000)));
		$this->assertTrue($this->provider(null)->isAvailable($this->fileInfo('SAM_0001.srw', 'application/octet-stream', 25_000_000)));
		$this->assertFalse($this->provider(null)->isAvailable($this->fileInfo('backup.bin', 'application/octet-stream', 25_000_000)));
	}

	// spec: IMAGES-001.6
	public function testScalesTheEmbeddedJpegDownToTheRequestedBox(): void {
		$image = $this->createMock(IImage::class);
		$image->expects($this->once())->method('scaleDownToFit')->with(2048, 1024)->willReturn(true);

		$thumbnail = $this->provider($image, $decodedBytes)->getThumbnail($this->raw("II*\0" . self::JPEG . "\0\0"), 2048, 1024);

		$this->assertSame($image, $thumbnail);
		$this->assertSame(self::JPEG, $decodedBytes);
	}

	// spec: IMAGES-001.7
	public function testHasNoThumbnailWithoutAnEmbeddedJpeg(): void {
		$this->assertNull($this->provider($this->createStub(IImage::class))->getThumbnail($this->raw("II*\0sensor"), 256, 256));
	}

	// spec: IMAGES-001.7
	public function testHasNoThumbnailWhenTheEmbeddedJpegDoesNotDecode(): void {
		$this->assertNull($this->provider(null)->getThumbnail($this->raw(self::JPEG), 256, 256));
	}

	// spec: IMAGES-001.7
	public function testHasNoThumbnailWhenTheRawCannotBeRead(): void {
		$locked = $this->createStub(File::class);
		$locked->method('getContent')->willThrowException(new LockedException('/alice/files/IMG_0001.NEF'));
		$forbidden = $this->createStub(File::class);
		$forbidden->method('getContent')->willThrowException(new NotPermittedException());

		$this->assertNull($this->provider($this->createStub(IImage::class))->getThumbnail($locked, 256, 256));
		$this->assertNull($this->provider($this->createStub(IImage::class))->getThumbnail($forbidden, 256, 256));
	}
}
