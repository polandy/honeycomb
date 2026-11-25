<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Folder;

use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Service\Folder\FolderPreviews;
use PHPUnit\Framework\TestCase;

final class FolderPreviewsTest extends TestCase {
	/** @return array{fileId: int, name: string, mtime: int, captureTime: ?int} */
	private static function photo(int $fileId, string $name, ?int $captureTime = null): array {
		return ['fileId' => $fileId, 'name' => $name, 'mtime' => 100 + $fileId, 'captureTime' => $captureTime];
	}

	/** @param list<array{fileId: int, name: string, mtime: int, captureTime: ?int}> $files */
	private static function ids(array $files): array {
		return array_column(FolderPreviews::pick($files, PairingExtensions::defaults()), 'fileId');
	}

	// spec: FOLDERS-005.18
	public function testTakesTheFirstTheMiddleAndTheLastInCaptureTimeOrder(): void {
		$files = [self::photo(5, 'e.jpg', 50), self::photo(1, 'a.jpg', 10), self::photo(3, 'c.jpg', 30), self::photo(4, 'd.jpg', 40), self::photo(2, 'b.jpg', 20)];

		$this->assertSame([1, 3, 5], self::ids($files));
	}

	// spec: FOLDERS-005.18
	public function testCarriesTheMtimeOfEachFile(): void {
		$this->assertSame([['fileId' => 7, 'mtime' => 107]], FolderPreviews::pick([self::photo(7, 'a.jpg')], PairingExtensions::defaults()));
	}

	// spec: FOLDERS-005.18
	public function testTakesTheFirstAndTheLastOfTwoAndTheOnlyOneOfOne(): void {
		$this->assertSame([1, 2], self::ids([self::photo(2, 'b.jpg', 2), self::photo(1, 'a.jpg', 1)]));
		$this->assertSame([1], self::ids([self::photo(1, 'a.jpg')]));
	}

	// spec: FOLDERS-005.18
	public function testTakesTheFirstThreeOfThreeAndSpreadsFour(): void {
		$files = array_map(static fn (int $n): array => self::photo($n, "p$n.jpg", $n), range(1, 4));

		$this->assertSame([1, 2, 3], self::ids(array_slice($files, 0, 3)));
		$this->assertSame([1, 2, 4], self::ids($files));
	}

	// spec: FOLDERS-005.18
	public function testPicturesWithoutACaptureTimeComeLastInNameOrder(): void {
		$files = [self::photo(1, 'z.jpg'), self::photo(2, 'a.jpg'), self::photo(3, 'm.jpg', 5), self::photo(4, 'n.jpg', 6), self::photo(5, 'o.jpg', 7)];

		$this->assertSame([3, 5, 1], self::ids($files));
	}

	// spec: FOLDERS-005.18
	public function testAPairStandsForItsRenderedFileAndARawAloneIsNoCandidate(): void {
		$files = [self::photo(1, 'a.nef', 1), self::photo(2, 'a.jpg', 1), self::photo(3, 'b.nef', 2)];

		$this->assertSame([2], self::ids($files));
		$this->assertSame([], self::ids([self::photo(3, 'b.nef', 2)]));
		$this->assertSame([], self::ids([]));
	}

	// spec: FOLDERS-005.18
	public function testAPairTakesItsEarliestMembersCaptureTime(): void {
		$files = [self::photo(1, 'a.jpg', 9), self::photo(2, 'a.nef', 1), self::photo(3, 'b.jpg', 5), self::photo(4, 'c.jpg', 6)];

		$this->assertSame([1, 3, 4], self::ids($files));
	}
}
