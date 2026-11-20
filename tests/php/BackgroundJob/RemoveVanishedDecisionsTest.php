<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\RemoveVanishedDecisions;
use OCA\Honeycomb\Service\EmptySeriesSweep;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\QualityValue;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\VanishedFileSweep;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Tests\Service\AppConfigStub;
use OCA\Honeycomb\Tests\Service\FakeDbException;
use OCA\Honeycomb\Tests\Service\FakeExistingFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeSeriesStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use OCA\Honeycomb\Tests\Service\XmpCacheRowTest;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class RemoveVanishedDecisionsTest extends TestCase {
	use AppConfigStub;

	private const int DAY = 86_400;

	private FakeExistingFiles $files;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeExistingFiles();
	}

	private function sweep(): VanishedFileSweep {
		return new VanishedFileSweep($this->files, $this->appConfigStub());
	}

	private function emptySeries(?FakeSeriesStore $store = null): EmptySeriesSweep {
		return new EmptySeriesSweep($store ?? new FakeSeriesStore(), $this->appConfigStub());
	}

	private function runJob(RemoveVanishedDecisions $job): void {
		(new \ReflectionMethod($job, 'run'))->invoke($job, null);
	}

	public function testRunsOnceADayAtAnyTime(): void {
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries(), $this->createStub(LoggerInterface::class));

		$this->assertSame(self::DAY, $job->getInterval());
		$this->assertFalse($job->isTimeSensitive());
	}

	// spec: DECISIONS-001.11, DECISIONS-001.31
	public function testRemovesTheFlagRowsOfFilesDeletedForGood(): void {
		$store = new FakeFlagStore();
		$store->rows = [7 => new FileFlag(7, Flag::Picked, false, 100), 8 => new FileFlag(8, Flag::Unflagged, true, 100)];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 flag row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores($store, new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame([8], array_keys($store->rows));
	}

	// spec: DECISIONS-001.11
	public function testLogsNothingWhenNoRowIsLeftBehind(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->never())->method('info');
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);
	}

	// spec: SERIES-003.10
	public function testRemovesTheVisualHashesOfFilesDeletedForGood(): void {
		$hashes = new FakeVisualHashStore();
		$hashes->rows = [7 => new VisualHash(7, 'etag-7', '0000000000000007'), 8 => new VisualHash(8, 'etag-8', '0000000000000008')];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 visual hash row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), $hashes, new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame([8], array_keys($hashes->rows));
	}

	// spec: SERIES-006.14
	public function testRemovesTheQualityValuesOfFilesDeletedForGood(): void {
		$quality = new FakeQualityStore();
		$quality->rows = [7 => new QualityValue(7, 'etag-7', 1, 3.0, 0), 8 => new QualityValue(8, 'etag-8', 1, 4.0, 1)];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 quality value row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore(), $quality), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame([8], array_keys($quality->rows));
	}

	// spec: XMP-006.8
	public function testRemovesTheXmpCacheRowsOfFilesDeletedForGood(): void {
		$row = XmpCacheRow::fromRequest(XmpCacheRowTest::item());
		$xmpCache = new FakeXmpCacheStore();
		$xmpCache->rows = ['alice' => [7 => $row, 8 => $row], 'bob' => [7 => $row]];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2 xmp cache rows'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), $xmpCache, new FakeQualityStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $xmpCache->rows));
	}

	// spec: DECISIONS-001.18
	public function testAFailedTableIsLoggedAndTheOthersAreCleaned(): void {
		$flags = new FakeFlagStore();
		$flags->readFails = true;
		$hashes = new FakeVisualHashStore();
		$hashes->rows = [7 => new VisualHash(7, 'etag-7', '0000000000000007')];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->stringContains('flag'), $this->callback(fn (array $context): bool => $context['exception'] instanceof FakeDbException));
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 visual hash row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores($flags, $hashes, new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame([], $hashes->rows);
	}

	// spec: SERIES-005.25
	public function testRemovesTheSeriesRowsOfFilesDeletedForGoodAndThenTheSeriesWithoutARow(): void {
		$series = new FakeSeriesStore();
		$gone = $series->add('alice', SeriesStatus::Open, 7);
		$kept = $series->add('alice', SeriesStatus::Done, 8, 9);
		$series->rows['bob'][7] = null;
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->exactly(2))->method('info')->with($this->logicalOr($this->stringContains('2 series member rows'), $this->stringContains('1 series without')));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), $series, new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries($series), $logger);
		$this->runJob($job);
		$this->assertSame([8 => $kept, 9 => $kept], $series->rows['alice'] ?? null);
		$this->assertSame([], $series->rows['bob'] ?? null);
		$this->assertSame([$kept], array_keys($series->series));
		$this->assertNotSame($gone, $kept);
	}

	// spec: DECISIONS-001.18
	public function testAFailedSeriesSweepIsLoggedAfterTheFileRows(): void {
		$series = new FakeSeriesStore();
		$series->seriesReadFails = true;
		$hashes = new FakeVisualHashStore();
		$hashes->rows = [7 => new VisualHash(7, 'etag-7', '0000000000000007')];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->stringContains('series without'), $this->callback(fn (array $context): bool => $context['exception'] instanceof FakeDbException));
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 visual hash row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeFlagStore(), $hashes, $series, new FakeXmpCacheStore(), new FakeQualityStore()), $this->sweep(), $this->emptySeries($series), $logger);
		$this->runJob($job);
		$this->assertSame([], $hashes->rows);
	}
}
