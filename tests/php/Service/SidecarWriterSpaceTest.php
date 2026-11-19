<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SidecarResult;
use OCP\Files\FileInfo;
use OCP\Files\NotEnoughSpaceException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** The checked save on a storage that keeps no versions or has no space left. */
final class SidecarWriterSpaceTest extends TestCase {
	use FakeSidecarFolder;

	// spec: XMP-002.11
	public function testAnExistingSidecarIsSavedInPlaceWithoutAskingForVersions(): void {
		$results = $this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame([SidecarResult::Saved], $this->resultsOf($results));
		$this->assertSame(['put IMG_0001.NEF.xmp'], $this->events);
		$this->assertSame('new', $this->disk['IMG_0001.NEF.xmp']);
	}

	// spec: XMP-002.12
	public function testANewSidecarLargerThanTheFreeSpaceIsNotWrittenAndTheOthersAreSaved(): void {
		$this->freeSpace = 4;

		$results = $this->writer()->save($this->user(), [$this->created('fresh'), $this->existing('newer')]);

		$this->assertSame([SidecarResult::NoSpace, SidecarResult::Saved], $this->resultsOf($results));
		$this->assertSame(['put IMG_0001.NEF.xmp'], $this->events);
		$this->assertArrayNotHasKey('IMG_0002.JPG.xmp', $this->disk);
	}

	// spec: XMP-002.12
	public function testAnExistingSidecarGrowingPastTheFreeSpaceIsNotOverwritten(): void {
		$this->freeSpace = 1;

		$results = $this->writer()->save($this->user(), [$this->existing('longer')]);

		$this->assertSame([SidecarResult::NoSpace], $this->resultsOf($results));
		$this->assertSame('old', $this->disk['IMG_0001.NEF.xmp']);
		$this->assertSame([], $this->events);
	}

	/** @return array<string, array{int|float}> */
	public static function unknownSpace(): array {
		return ['not computed' => [FileInfo::SPACE_NOT_COMPUTED], 'unknown' => [FileInfo::SPACE_UNKNOWN], 'unlimited' => [FileInfo::SPACE_UNLIMITED]];
	}

	// spec: XMP-002.12
	#[DataProvider('unknownSpace')]
	public function testAnUnknownOrUnlimitedFreeSpaceWrites(int|float $freeSpace): void {
		$this->freeSpace = $freeSpace;

		$results = $this->writer()->save($this->user(), [$this->created('fresh')]);

		$this->assertSame([SidecarResult::Saved], $this->resultsOf($results));
	}

	/** @return array<string, array{string}> */
	public static function writeSteps(): array {
		return ['replacing' => ['putContent'], 'creating' => ['newFile']];
	}

	// spec: XMP-002.12
	#[DataProvider('writeSteps')]
	public function testAFullQuotaWhileWritingAnswersNoSpaceAndTheOtherSidecarIsSaved(string $step): void {
		$this->failures[$step] = new NotEnoughSpaceException('quota');
		$sidecars = $step === 'putContent' ? [$this->existing('new'), $this->created('fresh')] : [$this->created('fresh'), $this->existing('new')];

		$results = $this->writer()->save($this->user(), $sidecars);

		$this->assertSame([SidecarResult::NoSpace, SidecarResult::Saved], $this->resultsOf($results));
		$this->assertSame($step === 'putContent' ? ['write IMG_0002.JPG.xmp'] : ['put IMG_0001.NEF.xmp'], $this->events);
		$this->assertSame(['IMG_0001.NEF', 'IMG_0001.NEF.xmp', 'IMG_0002.JPG', ...($step === 'putContent' ? ['IMG_0002.JPG.xmp'] : [])], array_keys($this->disk));
	}
}
