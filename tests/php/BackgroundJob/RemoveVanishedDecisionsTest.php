<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\RemoveVanishedDecisions;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class RemoveVanishedDecisionsTest extends TestCase {
	private const int DAY = 86_400;

	private function runJob(RemoveVanishedDecisions $job): void {
		(new \ReflectionMethod($job, 'run'))->invoke($job, null);
	}

	public function testRunsOnceADayAtAnyTime(): void {
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FakeDecisionStore(), new FakeTagStore(), new FakeVisualHashStore(), $this->createStub(LoggerInterface::class));

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
		$store->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), $store, new FakeTagStore(), new FakeVisualHashStore(), $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $store->rows));
	}

	// spec: DECISIONS-001.11
	public function testLogsNothingWhenNoRowIsLeftBehind(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->never())->method('info');
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FakeDecisionStore(), new FakeTagStore(), new FakeVisualHashStore(), $logger);

		$this->runJob($job);
	}

	// spec: TAGS-001.11
	public function testRemovesTheTagRowsOfFilesDeletedForGoodAndKeepsTheTagList(): void {
		$tags = new FakeTagStore();
		$tags->replace('alice', [7, 8], [new PictureTags(7, ['Anna']), new PictureTags(8, ['Bert'])]);
		$tags->replace('bob', [7], [new PictureTags(7, ['Carl'])]);
		$tags->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2 tag rows'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FakeDecisionStore(), $tags, new FakeVisualHashStore(), $logger);

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
		$hashes->vanished = [7];
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('info')->with($this->stringContains('2 visual hash rows'));
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FakeDecisionStore(), new FakeTagStore(), $hashes, $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $hashes->rows));
	}
}
