<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\RemoveVanishedDecisions;
use OCA\Honeycomb\Service\EmptySeriesSweep;
use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\VanishedFileSweep;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Tests\Service\AppConfigStub;
use OCA\Honeycomb\Tests\Service\FakeDbException;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCA\Honeycomb\Tests\Service\FakeExistingFiles;
use OCA\Honeycomb\Tests\Service\FakeSeriesStore;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
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
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeDecisionStore(), new FakeTagStore(), new FakeVisualHashStore(), new FakeSeriesStore()), $this->sweep(), $this->emptySeries(), $this->createStub(LoggerInterface::class));

		$this->assertSame(self::DAY, $job->getInterval());
		$this->assertFalse($job->isTimeSensitive());
	}

	// spec: DECISIONS-001.11
	public function testRemovesTheRowsOfFilesDeletedForGoodOfEveryUser(): void {
		$store = new FakeDecisionStore();
		$store->rows = [
			'alice' => [7 => new PictureDecision(7, 3, null, Flag::Picked, false), 8 => new PictureDecision(8, 1, null, Flag::Unflagged, false)],
			'bob' => [7 => new PictureDecision(7, 0, null, Flag::Rejected, false)],
		];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores($store, new FakeTagStore(), new FakeVisualHashStore(), new FakeSeriesStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $store->rows));
	}

	// spec: DECISIONS-001.11
	public function testLogsNothingWhenNoRowIsLeftBehind(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->never())->method('info');
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeDecisionStore(), new FakeTagStore(), new FakeVisualHashStore(), new FakeSeriesStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);
	}

	// spec: TAGS-001.11
	public function testRemovesTheTagRowsOfFilesDeletedForGoodAndKeepsTheTagList(): void {
		$tags = new FakeTagStore();
		$tags->replace('alice', [7, 8], [new PictureTags(7, ['Anna']), new PictureTags(8, ['Bert'])]);
		$tags->replace('bob', [7], [new PictureTags(7, ['Carl'])]);
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2 tag rows'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeDecisionStore(), $tags, new FakeVisualHashStore(), new FakeSeriesStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $tags->rows));
		$this->assertSame(['Anna', 'Bert'], $tags->tagList('alice'));
	}

	// spec: SERIES-003.10
	public function testRemovesTheVisualHashesOfFilesDeletedForGood(): void {
		$hashes = new FakeVisualHashStore();
		$hashes->rows = [
			'alice' => [7 => new VisualHash(7, 'etag-7', '0000000000000007'), 8 => new VisualHash(8, 'etag-8', '0000000000000008')],
			'bob' => [7 => new VisualHash(7, 'etag-7', '0000000000000007')],
		];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2 visual hash rows'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeDecisionStore(), new FakeTagStore(), $hashes, new FakeSeriesStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $hashes->rows));
	}

	// spec: DECISIONS-001.18
	public function testAFailedTableIsLoggedAndTheOthersAreCleaned(): void {
		$decisions = new FakeDecisionStore();
		$decisions->readFails = true;
		$hashes = new FakeVisualHashStore();
		$hashes->rows = ['alice' => [7 => new VisualHash(7, 'etag-7', '0000000000000007')]];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->stringContains('decision'), $this->callback(fn (array $context): bool => $context['exception'] instanceof FakeDbException));
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 visual hash row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores($decisions, new FakeTagStore(), $hashes, new FakeSeriesStore()), $this->sweep(), $this->emptySeries(), $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => []], array_map(array_keys(...), $hashes->rows));
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
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeDecisionStore(), new FakeTagStore(), new FakeVisualHashStore(), $series), $this->sweep(), $this->emptySeries($series), $logger);
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
		$hashes->rows = ['alice' => [7 => new VisualHash(7, 'etag-7', '0000000000000007')]];
		$this->files->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->stringContains('series without'), $this->callback(fn (array $context): bool => $context['exception'] instanceof FakeDbException));
		$logger->expects($this->once())->method('info')->with($this->stringContains('1 visual hash row'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FileRowStores(new FakeDecisionStore(), new FakeTagStore(), $hashes, $series), $this->sweep(), $this->emptySeries($series), $logger);
		$this->runJob($job);
		$this->assertSame(['alice' => []], array_map(array_keys(...), $hashes->rows));
	}
}
