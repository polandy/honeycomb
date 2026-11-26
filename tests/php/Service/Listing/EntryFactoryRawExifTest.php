<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Listing\CaptureTimes;
use OCA\Honeycomb\Service\Listing\EntryFactory;
use OCA\Honeycomb\Service\Listing\ListingService;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class EntryFactoryRawExifTest extends TestCase {
	use FakeFiles;

	private const int RAW_TIME = 1_762_768_801;
	private const int PHOTOS_TIME = 1_699_999_000;

	/** The capture time and camera of a NEF whose metadata holds `$values`. */
	private function listed(array $values): array {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willReturn([$this->file(7, '/Photos/DSC_0007.NEF', 'image/x-dcraw')]);
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('getMetadataForFiles')->willReturn([7 => $this->metadata($values)]);
		$factory = new EntryFactory($manager, new FakeVisualHashStore(), new FakeFlagStore(), new FakeQualityStore());
		$entry = $this->entriesOf((new ListingService(new UserFolderResolver($this->rootWith(['/Photos' => $folder])), $factory))->list($this->user(), '/Photos', false))[0];
		return ['captureTime' => $entry['captureTime'], 'camera' => $entry['camera']];
	}

	// spec: LISTING-004.11
	public function testAFileWithoutPhotosValuesTakesTheKeys(): void {
		$values = [RawExif::KEY => ['DateTimeOriginal' => self::RAW_TIME, 'Make' => 'NIKON CORPORATION', 'Model' => 'NIKON Z 6']];

		$this->assertSame(['captureTime' => self::RAW_TIME, 'camera' => 'NIKON CORPORATION NIKON Z 6'], $this->listed($values));
	}

	// spec: LISTING-004.11
	public function testPhotosValuesWinOverTheKeys(): void {
		$values = [
			CaptureTimes::KEY => self::PHOTOS_TIME,
			'photos-ifd0' => ['Make' => 'Canon', 'Model' => 'EOS R5'],
			RawExif::KEY => ['DateTimeOriginal' => self::RAW_TIME, 'Make' => 'NIKON CORPORATION', 'Model' => 'NIKON Z 6'],
		];

		$this->assertSame(['captureTime' => self::PHOTOS_TIME, 'camera' => 'Canon EOS R5'], $this->listed($values));
	}

	// spec: LISTING-004.11
	public function testAKeyWithOnlyAModelGivesTheModel(): void {
		$this->assertSame(['captureTime' => null, 'camera' => 'X-T5'], $this->listed([RawExif::KEY => ['Model' => 'X-T5']]));
	}

	/** @return array<string, array{array<string, mixed>}> */
	public static function emptyKeys(): array {
		return [
			'no key' => [[]],
			'an empty key, a header without the values' => [[RawExif::KEY => []]],
			'fields of the wrong type' => [[RawExif::KEY => ['DateTimeOriginal' => '2026:11:10 10:00:01', 'Make' => 5, 'Model' => ['Z 6']]]],
			'blank camera' => [[RawExif::KEY => ['Make' => ' ', 'Model' => '']]],
		];
	}

	// spec: LISTING-004.11
	#[DataProvider('emptyKeys')]
	public function testAKeyWithoutUsableFieldsLeavesBothNull(array $values): void {
		$this->assertSame(['captureTime' => null, 'camera' => null], $this->listed($values));
	}
}
