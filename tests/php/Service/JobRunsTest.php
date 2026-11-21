<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\BackgroundJobName;
use OCA\Honeycomb\Service\JobRuns;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\TestCase;

final class JobRunsTest extends TestCase {
	use AppConfigStub;

	private int $now = 1_000;

	private function runs(): JobRuns {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->now);
		return new JobRuns($this->appConfigStub(), $time);
	}

	// spec: APP-003.1
	public function testAJobThatNeverRanHasNoRunAndNoError(): void {
		$status = $this->runs()->status(BackgroundJobName::Sweep);

		$this->assertNull($status->lastRun);
		$this->assertFalse($status->failed);
		$this->assertNull($status->lastError);
		$this->assertNull($status->lastErrorAt);
	}

	// spec: APP-003.2
	public function testAGoodRunStoresItsTime(): void {
		$runs = $this->runs();

		$runs->succeeded(BackgroundJobName::Sweep);

		$status = $runs->status(BackgroundJobName::Sweep);
		$this->assertSame(1_000, $status->lastRun);
		$this->assertFalse($status->failed);
		$this->assertNull($status->lastError);
		$this->assertNull($runs->status(BackgroundJobName::WarmUp)->lastRun);
	}

	// spec: APP-003.3
	public function testAFailedRunStoresTheClassOfTheErrorAndNotItsText(): void {
		$runs = $this->runs();

		$runs->failed(BackgroundJobName::WarmUp, new FakeDbException(1));

		$status = $runs->status(BackgroundJobName::WarmUp);
		$this->assertSame(1_000, $status->lastRun);
		$this->assertTrue($status->failed);
		$this->assertSame(FakeDbException::class, $status->lastError);
		$this->assertSame(1_000, $status->lastErrorAt);
		$this->assertStringNotContainsString('database error', implode(' ', $this->appConfigStrings));
	}

	// spec: APP-003.4
	public function testALaterGoodRunKeepsTheLastError(): void {
		$runs = $this->runs();
		$runs->failed(BackgroundJobName::Sweep, new \RuntimeException('x'));
		$this->now = 2_000;

		$runs->succeeded(BackgroundJobName::Sweep);

		$status = $runs->status(BackgroundJobName::Sweep);
		$this->assertSame(2_000, $status->lastRun);
		$this->assertFalse($status->failed);
		$this->assertSame(\RuntimeException::class, $status->lastError);
		$this->assertSame(1_000, $status->lastErrorAt);
	}
}
