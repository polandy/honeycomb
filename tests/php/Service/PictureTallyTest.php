<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\PictureTally;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** The pictures and orphaned sidecars among the file names of one folder. */
final class PictureTallyTest extends TestCase {
	/**
	 * @param list<string> $photos
	 * @param list<string> $sidecars
	 * @param list<string> $videos
	 */
	private static function tally(array $photos, array $sidecars = [], array $videos = []): array {
		return PictureTally::of($photos, $videos, $sidecars);
	}

	/** @return array<string, array{list<string>, int}> */
	public static function folders(): array {
		return [
			'a RAW and a JPEG of one shot are one picture' => [['A.NEF', 'A.JPG'], 1],
			'a RAW and a HEIC are one picture' => [['A.cr2', 'A.HEIC'], 1],
			'case in the base name and the extension is ignored' => [['a.nef', 'A.jpg'], 1],
			'the base name runs up to the last dot' => [['A.1.NEF', 'A.1.JPG', 'A.JPG'], 2],
			'a JPEG alone is one picture' => [['A.JPG'], 1],
			'a RAW alone is one picture' => [['A.NEF'], 1],
			'two RAW files of one base name are two pictures' => [['A.NEF', 'A.DNG', 'A.JPG'], 3],
			'two rendered files of one base name are two pictures' => [['A.JPG', 'A.HEIC', 'A.NEF'], 3],
			'another photo type counts once each' => [['A.PNG', 'A.JPG', 'B.png'], 3],
			'an untyped RAW pairs like any RAW' => [['A.CR3', 'A.JPG'], 1],
			'no photos' => [[], 0],
		];
	}

	/** @param list<string> $photos */
	#[DataProvider('folders')]
	// spec: LISTING-003.19
	public function testCountsAPairOnce(array $photos, int $pictures): void {
		$this->assertSame($pictures, self::tally($photos)['pictures']);
	}

	/** @return array<string, array{list<string>, list<string>, int}> */
	public static function sidecars(): array {
		return [
			'a sidecar named after a member belongs to it' => [['A.NEF', 'A.JPG'], ['A.NEF.xmp', 'A.JPG.xmp'], 0],
			'a sidecar named after the base name belongs to the picture' => [['A.NEF', 'A.JPG'], ['A.xmp'], 0],
			'a darktable duplicate belongs to its member' => [['A.NEF'], ['A_01.NEF.xmp'], 0],
			'case is ignored' => [['a.nef'], ['A.NEF.XMP'], 0],
			'a sidecar without a photo is orphaned' => [['A.NEF'], ['B.xmp', 'B.JPG.xmp'], 2],
			'a sidecar of a missing member is orphaned' => [['A.NEF'], ['A.CR2.xmp'], 1],
			'sidecars without photos at all are orphaned' => [[], ['A.xmp', 'B.NEF.xmp'], 2],
		];
	}

	/**
	 * @param list<string> $photos
	 * @param list<string> $sidecars
	 */
	#[DataProvider('sidecars')]
	// spec: LISTING-003.23
	public function testCountsTheSidecarsNoPhotoOwns(array $photos, array $sidecars, int $orphans): void {
		$this->assertSame($orphans, self::tally($photos, $sidecars)['orphans']);
	}

	// spec: LISTING-003.23
	public function testAVideoOwnsItsSidecarButIsNoPicture(): void {
		$this->assertSame(['pictures' => 0, 'orphans' => 0], self::tally([], ['clip.MP4.xmp'], ['clip.MP4']));
	}
}
