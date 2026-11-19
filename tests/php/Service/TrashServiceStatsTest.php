<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\Files\Node;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;

final class TrashServiceStatsTest extends TestCase {
	use TrashServiceFixtures;

	/**
	 * A pair numbered from `$first`: the RAW of 300 bytes, its sidecar of 2, then the JPEG of 100.
	 * @return array<int, Node>
	 */
	private function pair(int $first, ?\Throwable $jpegFailure = null): array {
		$name = sprintf('IMG_%04d', $first);
		return [
			$first => $this->file($first, "$name.CR3", 'image/x-canon-cr3', size: 300),
			$first + 1 => $this->file($first + 1, "$name.CR3.xmp", 'application/octet-stream', size: 2),
			$first + 2 => $this->file($first + 2, "$name.JPG", failure: $jpegFailure, size: 100),
		];
	}

	// spec: STATS-001.8
	public function testCountsThePicturesFilesAndBytesMovedToTheTrashBin(): void {
		$nodes = $this->pair(1) + $this->pair(4) + $this->pair(7);

		$this->service($nodes)->trash($this->user(), [self::picture(1, 2, 3), self::picture(4, 5, 6), self::picture(7, 8, 9)]);

		$this->assertSame(['trash_pictures' => 3, 'trash_files' => 9, 'trash_bytes' => 1206], $this->counted());
	}

	// spec: STATS-001.9, STATS-001.30
	public function testAPictureWithAFileDeletedForGoodCountsAsDeletedForGood(): void {
		$nodes = [
			1 => $this->file(1, 'IMG_0001.CR3', 'image/x-canon-cr3', size: 1000),
			2 => $this->file(2, 'IMG_0001.JPG', size: 100),
			3 => $this->file(3, 'IMG_0002.JPG', size: 1000),
		];
		$pictures = [
			[['fileId' => 1, 'etag' => 'etag-1', 'permanent' => true], ['fileId' => 2, 'etag' => 'etag-2']],
			[['fileId' => 3, 'etag' => 'etag-3', 'permanent' => true]],
		];

		$this->service($nodes)->trash($this->user(), $pictures);

		$this->assertSame(['trash_files' => 1, 'trash_bytes' => 100, 'deleted_pictures' => 2, 'deleted_files' => 2, 'deleted_bytes' => 2000], $this->counted());
	}

	// spec: STATS-001.10
	public function testOnlyWholePicturesAndTheFilesThatSucceededCount(): void {
		$nodes = $this->pair(1, new LockedException('IMG_0001.JPG')) + $this->pair(4) + [7 => $this->file(7, 'IMG_0007.JPG')];
		$changed = [['fileId' => 7, 'etag' => 'etag-old']];

		$this->service($nodes)->trash($this->user(), [self::picture(1, 2, 3), self::picture(4, 5, 6), $changed]);

		$this->assertSame(['trash_pictures' => 1, 'trash_files' => 4, 'trash_bytes' => 702], $this->counted());
	}

	// spec: STATS-001.11
	public function testRemoveRawsCountsTheRawFilesAndTheirBytesOnly(): void {
		$nodes = $this->pair(1) + $this->pair(4);

		$this->service($nodes)->trash($this->user(), [self::picture(1, 2), self::picture(4, 5)], 'rawRemovable');

		$this->assertSame(['raws_removed' => 2, 'raws_removed_bytes' => 600], $this->counted());
	}

	// spec: STATS-001.7
	public function testAFailedCountLeavesTheDeleteAndItsAnswerAsTheyAre(): void {
		$this->failCounting();

		$results = $this->service($this->pair(1))->trash($this->user(), [self::picture(1, 2, 3)]);

		$this->assertSame([[['fileId' => 1, 'result' => 'trashed'], ['fileId' => 2, 'result' => 'trashed'], ['fileId' => 3, 'result' => 'trashed']]], self::results($results));
		$this->assertSame([1, 3, 2], $this->trashed);
		$this->assertSame(['Could not count the statistics.'], $this->statsWarnings);
	}

	// spec: STATS-001.10
	public function testNothingIsCountedWhenNothingSucceeded(): void {
		$this->service([])->trash($this->user(), [self::picture(1)]);

		$this->assertSame([], $this->statsStore()->rows);
	}
}
