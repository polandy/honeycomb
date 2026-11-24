<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Command\JobsStatus;
use OCA\Honeycomb\Service\Lifecycle\BackgroundJobName;
use OCA\Honeycomb\Service\Lifecycle\JobRuns;
use OCA\Honeycomb\Tests\Service\AppConfigStub;
use OCA\Honeycomb\Tests\Service\FakeDbException;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class JobsStatusTest extends TestCase {
	use AppConfigStub;

	private const int NOW = 1_800_000_000;
	private const int HOUR = 3_600;

	private int $clock = self::NOW;

	private function runs(): JobRuns {
		return new JobRuns($this->appConfigStub(), $this->time());
	}

	private function time(): ITimeFactory {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->clock);
		return $time;
	}

	private function display(JobRuns $runs): string {
		$tester = new CommandTester(new JobsStatus($runs, $this->time()));
		$this->assertSame(Command::SUCCESS, $tester->execute([]));
		return $tester->getDisplay();
	}

	// spec: APP-003.1
	public function testIsNamedForOcc(): void {
		$this->assertSame('honeycomb:jobs', (new JobsStatus($this->runs(), $this->time()))->getName());
	}

	// spec: APP-003.1
	public function testSaysNeverRunForEveryJobThatDidNot(): void {
		$display = $this->display($this->runs());

		$this->assertStringContainsString('sweep: never run, last error none', $display);
		$this->assertStringContainsString('warm-up: never run, last error none', $display);
	}

	// spec: APP-003.2
	public function testShowsTheTimeAndAgeOfAGoodRun(): void {
		$runs = $this->runs();
		$this->clock = self::NOW - 2 * self::HOUR;
		$runs->succeeded(BackgroundJobName::Sweep);
		$this->clock = self::NOW;

		$display = $this->display($runs);

		$this->assertStringContainsString('sweep: ok, last run ' . gmdate('Y-m-d H:i:s', self::NOW - 2 * self::HOUR) . ' UTC (2 hours ago), last error none', $display);
		$this->assertStringContainsString('warm-up: never run', $display);
	}

	// spec: APP-003.3
	public function testShowsTheClassAndTimeOfTheError(): void {
		$runs = $this->runs();
		$this->clock = self::NOW - 90;
		$runs->failed(BackgroundJobName::WarmUp, new FakeDbException(1));
		$this->clock = self::NOW;

		$display = $this->display($runs);

		$this->assertStringContainsString('warm-up: failed, last run ' . gmdate('Y-m-d H:i:s', self::NOW - 90) . ' UTC (1 minute ago), last error ' . FakeDbException::class . ' at ' . gmdate('Y-m-d H:i:s', self::NOW - 90) . ' UTC', $display);
		$this->assertStringNotContainsString('database error', $display);
	}

	// spec: APP-003.4
	public function testAGoodRunAfterAFailureStillNamesTheError(): void {
		$runs = $this->runs();
		$this->clock = self::NOW - 3 * 86_400;
		$runs->failed(BackgroundJobName::Sweep, new \RuntimeException('x'));
		$this->clock = self::NOW - 30;
		$runs->succeeded(BackgroundJobName::Sweep);
		$this->clock = self::NOW;

		$display = $this->display($runs);

		$this->assertStringContainsString('sweep: ok, last run ' . gmdate('Y-m-d H:i:s', self::NOW - 30) . ' UTC (30 seconds ago), last error ' . \RuntimeException::class . ' at ' . gmdate('Y-m-d H:i:s', self::NOW - 3 * 86_400) . ' UTC', $display);
	}
}
