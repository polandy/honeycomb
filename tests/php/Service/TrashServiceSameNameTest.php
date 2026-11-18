<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use PHPUnit\Framework\TestCase;

final class TrashServiceSameNameTest extends TestCase {
	use TrashServiceFixtures;

	// spec: DELETE-001.13
	public function testTrashesFilesOfOneNameInDifferentSecondsAndTheOtherPicturesFirst(): void {
		$nodes = [
			1 => $this->file(1, 'IMG_0001.JPG'),
			2 => $this->file(2, 'IMG_0001.JPG'),
			3 => $this->file(3, 'IMG_0002.JPG'),
			4 => $this->file(4, 'IMG_0001.JPG'),
		];

		$results = $this->service($nodes)->trash($this->user(), [self::picture(1), self::picture(2), self::picture(3), self::picture(4)]);

		$this->assertSame([
			[['fileId' => 1, 'result' => 'trashed']],
			[['fileId' => 2, 'result' => 'trashed']],
			[['fileId' => 3, 'result' => 'trashed']],
			[['fileId' => 4, 'result' => 'trashed']],
		], self::results($results));
		$this->assertSame([1, 3, 2, 4], $this->trashed);
		$this->assertSame([1 => 100, 3 => 100, 2 => 101, 4 => 102], $this->trashedAt);
		$this->assertSame([101, 102], $this->clock()->pauses);
	}

	// spec: DELETE-001.13
	public function testTwoFilesOfOneNameInOnePictureAreTrashedInDifferentSeconds(): void {
		$nodes = [1 => $this->file(1, 'IMG_0001.JPG'), 2 => $this->file(2, 'IMG_0001.JPG')];

		$results = $this->service($nodes)->trash($this->user(), [self::picture(1, 2)]);

		$this->assertSame([[['fileId' => 1, 'result' => 'trashed'], ['fileId' => 2, 'result' => 'trashed']]], self::results($results));
		$this->assertSame([1 => 100, 2 => 101], $this->trashedAt);
	}

	// spec: DELETE-001.13
	public function testAFileDeletedForGoodDoesNotWait(): void {
		$nodes = [1 => $this->file(1, 'IMG_0001.JPG'), 2 => $this->file(2, 'IMG_0001.JPG', size: 1000)];
		$pictures = [self::picture(1), [['fileId' => 2, 'etag' => 'etag-2', 'permanent' => true]]];

		$results = $this->service($nodes)->trash($this->user(), $pictures);

		$this->assertSame([[['fileId' => 1, 'result' => 'trashed']], [['fileId' => 2, 'result' => 'deleted']]], self::results($results));
		$this->assertSame([1 => 100, 2 => 100], $this->trashedAt);
		$this->assertSame([], $this->clock()->pauses);
	}

	// spec: DELETE-001.13
	public function testAPictureThatFailsItsCheckDoesNotWait(): void {
		$nodes = [1 => $this->file(1, 'IMG_0001.JPG'), 2 => $this->file(2, 'IMG_0001.JPG')];

		$results = $this->service($nodes)->trash($this->user(), [self::picture(1), [['fileId' => 2, 'etag' => 'etag-old']]]);

		$this->assertSame([[['fileId' => 1, 'result' => 'trashed']], [['fileId' => 2, 'result' => 'changed']]], self::results($results));
		$this->assertSame([], $this->clock()->pauses);
	}
}
