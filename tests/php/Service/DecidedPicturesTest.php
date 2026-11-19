<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\DecidedPictures;
use PHPUnit\Framework\TestCase;

final class DecidedPicturesTest extends TestCase {
	/** @return array{userId: string, flag: string, parent: ?int, name: ?string} */
	private static function row(string $userId, string $flag, ?int $parent, ?string $name): array {
		return ['userId' => $userId, 'flag' => $flag, 'parent' => $parent, 'name' => $name];
	}

	// spec: STATS-001.24
	public function testCountsEachUsersPicturesWithAPickOrAReject(): void {
		$counts = DecidedPictures::count([
			self::row('alice', 'picked', 10, 'IMG_1.JPG'),
			self::row('alice', 'picked', 10, 'IMG_1.CR3'),
			self::row('alice', 'rejected', 10, 'IMG_2.JPG'),
			self::row('alice', 'unflagged', 10, 'IMG_3.JPG'),
			self::row('alice', 'picked', 11, 'IMG_1.JPG'),
			self::row('bob', 'rejected', 10, 'IMG_1.JPG'),
			self::row('carol', 'unflagged', 10, 'IMG_1.JPG'),
		]);

		$this->assertSame(['alice' => 3, 'bob' => 1], $counts);
	}

	// spec: STATS-001.24
	public function testAPictureWithOneDecidedMemberCountsOnce(): void {
		$counts = DecidedPictures::count([
			self::row('alice', 'unflagged', 10, 'IMG_1.JPG'),
			self::row('alice', 'rejected', 10, 'IMG_1.CR3'),
		]);

		$this->assertSame(['alice' => 1], $counts);
	}

	// spec: STATS-001.24
	public function testARowWithoutAFileCountsAsItsOwnPicture(): void {
		$counts = DecidedPictures::count([
			self::row('alice', 'picked', null, null),
			self::row('alice', 'picked', null, null),
			self::row('alice', 'picked', 10, 'IMG_1.JPG'),
		]);

		$this->assertSame(['alice' => 3], $counts);
	}
}
