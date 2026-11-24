<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Listing\EntryFactory;
use OCA\Honeycomb\Service\Listing\ListingService;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ListingServiceExposureTest extends TestCase {
	use FakeFiles;

	/** @param array<string, mixed> $values */
	private function exposureOf(array $values): mixed {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([$this->file(7, '/Photos/IMG_0007.JPG')]);
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('getMetadataForFiles')->willReturn([7 => $this->metadata($values)]);
		$service = new ListingService(new UserFolderResolver($this->rootWith(['/Photos' => $folder])), new EntryFactory($manager, new FakeVisualHashStore(), new FakeFlagStore(), new FakeQualityStore()));

		return $this->entriesOf($service->list($this->user(), '/Photos', false))[0]['exposure'];
	}

	/** @return array<string, array{array<string, mixed>, array<string, float|int|null>|null}> */
	public static function exifValues(): array {
		$all = ['exposureTime' => 1 / 15, 'focalLength' => 200.0, 'focalLength35' => 300.0, 'aperture' => 5.6, 'iso' => 800];
		return [
			'rationals' => [['photos-exif' => ['ExposureTime' => '1/15', 'FocalLength' => '200/1', 'FocalLengthIn35mmFilm' => 300, 'FNumber' => '56/10', 'ISOSpeedRatings' => 800]], $all],
			'numbers' => [['photos-exif' => ['ExposureTime' => 1 / 15, 'FocalLength' => 200, 'FocalLengthIn35mmFilm' => '300', 'FNumber' => 5.6, 'ISOSpeedRatings' => '800']], $all],
			'some missing' => [['photos-exif' => ['ExposureTime' => '1/250']], ['exposureTime' => 0.004, 'focalLength' => null, 'focalLength35' => null, 'aperture' => null, 'iso' => null]],
			'unusable values are missing' => [['photos-exif' => ['ExposureTime' => '1/0', 'FocalLength' => 0, 'FocalLengthIn35mmFilm' => -5, 'FNumber' => 'wide', 'ISOSpeedRatings' => 100]], ['exposureTime' => null, 'focalLength' => null, 'focalLength35' => null, 'aperture' => null, 'iso' => 100]],
			'none' => [['photos-exif' => ['Flash' => 16]], null],
			'no metadata' => [[], null],
		];
	}

	// spec: LISTING-001.20
	/**
	 * @param array<string, mixed> $values
	 * @param array<string, float|int|null>|null $expected
	 */
	#[DataProvider('exifValues')]
	public function testAnEntryCarriesItsExposureFacts(array $values, ?array $expected): void {
		$exposure = $this->exposureOf($values);

		if ($expected === null) {
			$this->assertNull($exposure);
			return;
		}
		$this->assertIsArray($exposure);
		$this->assertSame(array_keys($expected), array_keys($exposure));
		$this->assertEqualsWithDelta($expected, $exposure, 0.0001);
	}
}
