<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SidecarResult;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/** What a sidecar save counts, against the in-memory folder of FakeSidecarFolder at 1 March 2026, 23:30 UTC. */
final class SidecarWriterStatsTest extends TestCase {
	use FakeSidecarFolder;

	/** 1 March 2026, 00:00 UTC: the start of the day the tests run on. */
	private const int START_OF_DAY = 1_772_323_200;

	#[\Override]
	protected function setUp(): void {
		$this->writtenAt = self::$statsNow;
	}

	// spec: STATS-001.12
	public function testACreatedSidecarCountsAsCreatedAndItsNextSaveTheSameDayNotAsUpdated(): void {
		$this->writer()->save($this->user(), [$this->created('fresh')]);
		$this->mtimes['IMG_0001.NEF.xmp'] = self::START_OF_DAY;
		$this->writer()->save($this->user(), [$this->existing('new')]);

		$this->assertSame(['sidecars_created' => 1], $this->counted());
	}

	// spec: STATS-001.13
	public function testASidecarLastChangedBeforeTodayCountsAsUpdatedOnceThatDay(): void {
		$this->mtimes['IMG_0001.NEF.xmp'] = self::START_OF_DAY - 1;

		foreach (['old' => 'a', 'a' => 'b', 'b' => 'c'] as $before => $after) {
			$this->writer()->save($this->user(), [$this->existing($after, md5($before), strlen($before))]);
		}

		$this->assertSame('c', $this->disk['IMG_0001.NEF.xmp']);
		$this->assertSame(['sidecars_updated' => 1], $this->counted());
	}

	// spec: STATS-001.37
	public function testAddsTheCountsOfTheSavedSidecars(): void {
		$this->writer()->save($this->user(), [
			['counts' => ['ratings_set' => 1, 'colour_labels_set' => 1]] + $this->created('fresh'),
			['counts' => ['ratings_set' => 1, 'tags_set' => 1]] + $this->existing('new'),
		]);

		$this->assertEquals(['sidecars_created' => 1, 'sidecars_updated' => 1, 'ratings_set' => 2, 'colour_labels_set' => 1, 'tags_set' => 1], $this->counted());
	}

	// spec: STATS-001.36
	public function testASidecarThatChangedMeanwhileCountsNothing(): void {
		$this->writer()->save($this->user(), [['counts' => ['ratings_set' => 1]] + $this->existing('new', etag: 'etag-seen')]);

		$this->assertSame([], $this->statsStore()->rows);
	}

	// spec: STATS-001.38
	public function testASidecarFromDigiKamOrDarktableCountsWhenItCountsAsUpdated(): void {
		$this->mtimes['IMG_0001.NEF.xmp'] = self::START_OF_DAY - 1;

		$this->writer()->save($this->user(), [['foreign' => true] + $this->existing('new')]);
		$this->writer()->save($this->user(), [['foreign' => true] + $this->existing('newer', md5('new'), 3)]);

		$this->assertSame(['sidecars_updated' => 1, 'sidecars_foreign' => 1], $this->counted());
	}

	// spec: STATS-001.10
	public function testAFailedSaveCountsNothing(): void {
		$this->failures['newFile'] = new LockedException('IMG_0002.JPG.xmp');

		$this->writer()->save($this->user(), [$this->created('fresh'), $this->existing('new', etag: 'etag-seen')]);

		$this->assertSame([], $this->statsStore()->rows);
	}

	// spec: STATS-001.7
	public function testAnUnreadableModificationTimeCountsNothingAndTheSaveGoesOn(): void {
		$this->mtimeFailure = new \RuntimeException('storage gone');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with('Could not read the modification time of a sidecar to count it');

		$results = $this->writer($logger)->save($this->user(), [$this->existing('new')]);

		$this->assertSame('new', $this->disk['IMG_0001.NEF.xmp']);
		$this->assertSame(SidecarResult::Saved, $results[0]['result']);
		$this->assertSame([], $this->statsStore()->rows);
	}

	// spec: STATS-001.5, STATS-001.7
	public function testAFailedCountLeavesTheSaveItsBytesAndItsAnswerAsTheyAre(): void {
		$this->failCounting();

		$results = $this->writer()->save($this->user(), [$this->created('fresh')]);

		$this->assertSame('fresh', $this->disk['IMG_0002.JPG.xmp']);
		$this->assertSame([['result' => SidecarResult::Saved, 'fileId' => self::NEW_ID, 'etag' => md5('fresh'), 'size' => 5, 'mtime' => self::$statsNow]], $results);
		$this->assertSame(['Could not count the statistics.'], $this->statsWarnings);
	}
}
