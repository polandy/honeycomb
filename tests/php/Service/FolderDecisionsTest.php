<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderDecisions;
use PHPUnit\Framework\TestCase;

final class FolderDecisionsTest extends TestCase {
	/** @return array{parent: int, name: string, flag: ?string, updatedAt: ?int, doneSeries: bool} */
	private static function row(int $parent, string $name, ?string $flag, int $updatedAt = 1, bool $doneSeries = false): array {
		return ['parent' => $parent, 'name' => $name, 'flag' => $flag, 'updatedAt' => $flag === null ? null : $updatedAt, 'doneSeries' => $doneSeries];
	}

	// spec: FOLDERS-005.9
	public function testCountsEachPictureByItsLatestRowAndTheDoneSeries(): void {
		$counts = FolderDecisions::of([
			self::row(7, 'a.jpg', 'picked', 20),
			self::row(7, 'A.CR3', 'rejected', 10),
			self::row(7, 'b.jpg', 'rejected'),
			self::row(7, 'c.jpg', null, doneSeries: true),
			self::row(7, 'd.jpg', 'unflagged', doneSeries: true),
			self::row(7, 'e.jpg', 'picked', doneSeries: true),
			self::row(7, 'f.jpg', 'unflagged'),
			self::row(8, 'a.jpg', 'picked'),
		]);

		$this->assertSame([7 => ['picked' => 2, 'rejected' => 1, 'doneUnflagged' => 2], 8 => ['picked' => 1, 'rejected' => 0, 'doneUnflagged' => 0]], $counts);
	}

	// spec: FOLDERS-005.9
	public function testAPictureIsInADoneSeriesWhenAnyMemberIs(): void {
		$counts = FolderDecisions::of([self::row(7, 'a.jpg', null), self::row(7, 'a.nef', null, doneSeries: true)]);

		$this->assertSame([7 => ['picked' => 0, 'rejected' => 0, 'doneUnflagged' => 1]], $counts);
	}

	// spec: FOLDERS-005.9
	public function testRowsOfTheSameSecondKeepTheFirstMembers(): void {
		$counts = FolderDecisions::of([self::row(7, 'a.jpg', 'rejected', 5), self::row(7, 'a.nef', 'picked', 5)]);

		$this->assertSame([7 => ['picked' => 0, 'rejected' => 1, 'doneUnflagged' => 0]], $counts);
	}
}
