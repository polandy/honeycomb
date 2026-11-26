<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use OCA\Honeycomb\Service\Listing\CaptureTimes;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\TestCase;

final class CaptureTimesTest extends TestCase {
	use FakeFiles;

	// spec: LISTING-004.12
	public function testTakesPhotosTimeFirstAndTheKeysForAFileWithoutIt(): void {
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('getMetadataForFiles')->willReturn([
			1 => $this->metadata([CaptureTimes::KEY => 1_000]),
			2 => $this->metadata([RawExif::KEY => ['DateTimeOriginal' => 1_001]]),
			3 => $this->metadata([CaptureTimes::KEY => 1_002, RawExif::KEY => ['DateTimeOriginal' => 9_999]]),
			4 => $this->metadata([RawExif::KEY => []]),
			5 => $this->metadata([]),
			6 => $this->metadata([RawExif::KEY => ['DateTimeOriginal' => '2026:11:10 10:00:01']]),
		]);

		$this->assertSame([1 => 1_000, 2 => 1_001, 3 => 1_002], (new CaptureTimes($manager))->of([1, 2, 3, 4, 5, 6]));
	}
}
