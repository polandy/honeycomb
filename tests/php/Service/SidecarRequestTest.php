<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\ExistingSidecar;
use OCA\Honeycomb\Service\InvalidSidecarRequestException;
use OCA\Honeycomb\Service\NewSidecar;
use OCA\Honeycomb\Service\SidecarLimits;
use OCA\Honeycomb\Service\SidecarRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SidecarRequestTest extends TestCase {
	private const array EXISTING = ['fileId' => 9, 'etag' => 'etag-9', 'size' => 3, 'content' => 'b2xk'];
	private const array CREATED = ['path' => '/Photos/IMG_0001.NEF.xmp', 'content' => 'bmV3'];

	// spec: XMP-002.3, XMP-002.4
	public function testReadsExistingAndNewSidecarsWithTheirBytes(): void {
		$this->assertEquals([
			new ExistingSidecar(9, 'etag-9', 3, 'old'),
			new NewSidecar('/Photos/IMG_0001.NEF.xmp', 'new'),
			new NewSidecar('/IMG_0002.JPG.XMP', ''),
		], SidecarRequest::sidecars([self::EXISTING, self::CREATED, ['path' => '/IMG_0002.JPG.XMP', 'content' => '']]));
	}

	public function testAcceptsTheLimits(): void {
		$sidecars = SidecarRequest::sidecars([['path' => '/a.jpg.xmp', 'content' => base64_encode(str_repeat('x', SidecarLimits::MAX_BYTES))]]);

		$this->assertSame(SidecarLimits::MAX_BYTES, strlen($sidecars[0]->bytes));
		$this->assertCount(SidecarLimits::MAX_ITEMS, SidecarRequest::fileIds(range(1, SidecarLimits::MAX_ITEMS)));
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedSidecars(): array {
		$created = static fn (string $path): array => [['path' => $path, 'content' => 'bmV3']];
		return [
			'not a list' => [['a' => self::EXISTING]],
			'not an object' => [['IMG_0001.NEF.xmp']],
			'no content' => [[['fileId' => 9, 'etag' => 'etag-9', 'size' => 3]]],
			'content not base64' => [[['path' => '/a.jpg.xmp', 'content' => 'b2x*']]],
			'content over the limit' => [[['path' => '/a.jpg.xmp', 'content' => base64_encode(str_repeat('x', SidecarLimits::MAX_BYTES + 1))]]],
			'both an id and a path' => [[self::EXISTING + self::CREATED]],
			'neither an id nor a path' => [[['content' => 'bmV3']]],
			'id zero' => [[['fileId' => 0] + self::EXISTING]],
			'id as text' => [[['fileId' => '9'] + self::EXISTING]],
			'empty etag' => [[['etag' => ''] + self::EXISTING]],
			'negative size' => [[['size' => -1] + self::EXISTING]],
			'no size' => [[['fileId' => 9, 'etag' => 'etag-9', 'content' => 'b2xk']]],
			'path with ..' => [$created('/Photos/../IMG_0001.NEF.xmp')],
			'relative path' => [$created('Photos/IMG_0001.NEF.xmp')],
			'path not ending in .xmp' => [$created('/Photos/IMG_0001.NEF')],
			'path naming no image' => [$created('/Photos/.xmp')],
			'path with a null byte' => [$created("/Photos/IMG\0.NEF.xmp")],
			'id given twice' => [[self::EXISTING, self::EXISTING]],
			'path given twice' => [[self::CREATED, self::CREATED]],
			'too many' => [array_fill(0, SidecarLimits::MAX_ITEMS + 1, self::CREATED)],
		];
	}

	// spec: XMP-002.7
	#[DataProvider('malformedSidecars')]
	public function testRefusesAMalformedSave(array $sidecars): void {
		$this->expectException(InvalidSidecarRequestException::class);
		SidecarRequest::sidecars($sidecars);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedFileIds(): array {
		return [
			'not a list' => [['a' => 1]],
			'not an id' => [['9']],
			'zero' => [[0]],
			'given twice' => [[9, 9]],
			'too many' => [range(1, SidecarLimits::MAX_ITEMS + 1)],
		];
	}

	// spec: XMP-002.7
	#[DataProvider('malformedFileIds')]
	public function testRefusesAMalformedLookup(array $fileIds): void {
		$this->expectException(InvalidSidecarRequestException::class);
		SidecarRequest::fileIds($fileIds);
	}
}
