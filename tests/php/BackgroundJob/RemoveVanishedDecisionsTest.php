<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\RemoveVanishedDecisions;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class RemoveVanishedDecisionsTest extends TestCase {
	private const int DAY = 86_400;

	private function runJob(RemoveVanishedDecisions $job): void {
		(new \ReflectionMethod($job, 'run'))->invoke($job, null);
	}

	public function testRunsOnceADayAtAnyTime(): void {
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FakeDecisionStore(), $this->createStub(LoggerInterface::class));

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
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), $store, $logger);

		$this->runJob($job);

		$this->assertSame(['alice' => [8], 'bob' => []], array_map(array_keys(...), $store->rows));
	}

	// spec: DECISIONS-001.11
	public function testLogsNothingWhenNoRowIsLeftBehind(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->never())->method('info');
		$job = new RemoveVanishedDecisions($this->createStub(ITimeFactory::class), new FakeDecisionStore(), $logger);

		$this->runJob($job);
	}
}
