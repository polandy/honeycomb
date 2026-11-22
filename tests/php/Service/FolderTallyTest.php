<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderTally;
use OCA\Honeycomb\Service\PairingExtensions;
use PHPUnit\Framework\TestCase;

final class FolderTallyTest extends TestCase {
	private const int MB = 1_000_000;

	/** @return array{name: string, size: int, mtime: int, captureTime: ?int} */
	private static function photo(string $name, int $size = 1, int $mtime = 0, ?int $captureTime = null): array {
		return ['name' => $name, 'size' => $size, 'mtime' => $mtime, 'captureTime' => $captureTime];
	}

	// spec: FOLDERS-001.1
	public function testCountsAPairOnceAndLeavesOutOtherFiles(): void {
		$tally = FolderTally::of([self::photo('a.jpg'), self::photo('A.CR3'), self::photo('b.jpg'), self::photo('c.png')], PairingExtensions::defaults());

		$this->assertSame(2, $tally['photos']);
	}

	// spec: FOLDERS-001.2
	public function testAddsTheBytesOfEveryPhotoFileAndOfTheRawsAlone(): void {
		$tally = FolderTally::of([self::photo('a.jpg', 3 * self::MB), self::photo('a.nef', 25 * self::MB), self::photo('b.jpg', 4 * self::MB), self::photo('c.png', 9 * self::MB)], PairingExtensions::defaults());

		$this->assertSame(32 * self::MB, $tally['bytes']);
		$this->assertSame(25 * self::MB, $tally['rawBytes']);
	}

	// spec: FOLDERS-001.3
	public function testCountsThePicturesTakenWithinTheSeriesGapOfTheirPredecessor(): void {
		$files = array_map(static fn (int $second): array => self::photo("p$second.jpg", captureTime: 1_000 + $second), [12, 0, 5, 2, 9]);
		$files[] = self::photo('none.jpg');

		$this->assertSame(3, FolderTally::of($files, PairingExtensions::defaults())['bursts']);
	}

	// spec: FOLDERS-001.3
	public function testAPairIsOneShotForTheBurstCount(): void {
		$files = [self::photo('a.jpg', captureTime: 100), self::photo('a.cr2', captureTime: 101), self::photo('b.jpg', captureTime: 200)];

		$this->assertSame(0, FolderTally::of($files, PairingExtensions::defaults())['bursts']);
	}

	// spec: FOLDERS-001.3
	public function testTheBurstGapIsTheSeriesGapOfTheBrowser(): void {
		$this->assertSame(1, preg_match('/^export const SERIES_GAP_SECONDS = (\d+)$/m', self::seriesModule(), $match));
		$this->assertSame((int)$match[1], FolderTally::BURST_GAP_SECONDS);
	}

	/** @psalm-suppress ForbiddenCode Reads the app's own TypeScript, not a user file. */
	private static function seriesModule(): string {
		return (string)file_get_contents(__DIR__ . '/../../../src/logic/series.ts');
	}

	// spec: FOLDERS-001.4
	public function testTakesTheCaptureTimesAndTheLastModification(): void {
		$files = [self::photo('a.jpg', mtime: 50, captureTime: 300), self::photo('a.cr2', mtime: 70, captureTime: 200), self::photo('b.jpg', mtime: 60, captureTime: 900), self::photo('c.jpg', mtime: 10)];

		$tally = FolderTally::of($files, PairingExtensions::defaults());

		$this->assertSame([200, 900, 70], [$tally['oldest'], $tally['newest'], $tally['lastActivity']]);
	}

	// spec: FOLDERS-001.4
	public function testAFolderWithoutCaptureTimesOrPhotosHasNoAges(): void {
		$this->assertSame(['photos' => 1, 'bytes' => 1, 'rawBytes' => 0, 'bursts' => 0, 'oldest' => null, 'newest' => null, 'lastActivity' => 5], FolderTally::of([self::photo('a.jpg', mtime: 5)], PairingExtensions::defaults()));
		$this->assertSame(['photos' => 0, 'bytes' => 0, 'rawBytes' => 0, 'bursts' => 0, 'oldest' => null, 'newest' => null, 'lastActivity' => null], FolderTally::of([self::photo('notes.png')], PairingExtensions::defaults()));
	}
}
