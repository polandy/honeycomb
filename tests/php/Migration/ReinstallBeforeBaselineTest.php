<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Migration;

use OCA\Honeycomb\Migration\ReinstallBeforeBaseline;
use OCA\Honeycomb\Tests\Command\FakeAppRemoval;
use OCP\IAppConfig;
use OCP\Migration\IOutput;
use PHPUnit\Framework\TestCase;

final class ReinstallBeforeBaselineTest extends TestCase {
	/** @var array<string, string> */
	private array $values = [];
	/** @var list<string> */
	private array $deleted = [];
	/** @var list<string> */
	private array $infos = [];
	/** @var list<string> */
	private array $warnings = [];

	private function step(FakeAppRemoval $removal): ReinstallBeforeBaseline {
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(fn (string $app, string $key): string => $app === 'honeycomb' ? ($this->values[$key] ?? '') : '');
		$config->method('deleteKey')->willReturnCallback(function (string $app, string $key): void {
			$this->deleted[] = "$app.$key";
		});
		return new ReinstallBeforeBaseline($config, $removal);
	}

	private function updateOutput(): IOutput {
		$output = $this->createStub(IOutput::class);
		$output->method('info')->willReturnCallback(function (string $message): void {
			$this->infos[] = $message;
		});
		$output->method('warning')->willReturnCallback(function (string $message): void {
			$this->warnings[] = $message;
		});
		return $output;
	}

	// spec: DECISIONS-001.39
	public function testWithTheValueBelowTheBaselineDropsTheTablesNamesThemAndDeletesTheValue(): void {
		$this->values = ['reinstall' => 'yes', 'installed_version' => '0.1.0'];
		$removal = new FakeAppRemoval(['honeycomb_flags', 'honeycomb_tags']);

		$this->step($removal)->run($this->updateOutput());

		$this->assertSame([], $removal->tables);
		$this->assertSame(1, $removal->tableDrops);
		$this->assertSame(0, $removal->removals);
		$this->assertStringContainsString('honeycomb_flags, honeycomb_tags', implode("\n", $this->infos));
		$this->assertSame(['honeycomb.reinstall'], $this->deleted);
	}

	// spec: DECISIONS-001.39
	public function testWithoutTheValueChangesNothing(): void {
		$this->values = ['installed_version' => '0.1.0'];
		$removal = new FakeAppRemoval(['honeycomb_flags']);

		$this->step($removal)->run($this->updateOutput());

		$this->assertSame(['honeycomb_flags'], $removal->tables);
		$this->assertSame(0, $removal->tableDrops);
		$this->assertSame([], $this->deleted);
		$this->assertSame([], $this->infos);
	}

	// spec: DECISIONS-001.39
	public function testAtOrAfterTheBaselineDropsNothingWarnsAndDeletesTheValue(): void {
		$this->values = ['reinstall' => 'yes', 'installed_version' => '0.2.0'];
		$removal = new FakeAppRemoval(['honeycomb_decisions']);

		$this->step($removal)->run($this->updateOutput());

		$this->assertSame(['honeycomb_decisions'], $removal->tables);
		$this->assertSame(0, $removal->tableDrops);
		$this->assertStringContainsString('reinstall', implode("\n", $this->warnings));
		$this->assertSame(['honeycomb.reinstall'], $this->deleted);
	}

	// spec: DECISIONS-001.39
	public function testAFailedDropKeepsTheValueSoTheUpdateRunsItAgain(): void {
		$this->values = ['reinstall' => 'yes', 'installed_version' => '0.1.0'];
		$removal = new FakeAppRemoval(['honeycomb_flags']);
		$removal->failure = new \RuntimeException('connection lost');

		try {
			$this->step($removal)->run($this->updateOutput());
			$this->fail('The failure was swallowed.');
		} catch (\RuntimeException $e) {
			$this->assertSame('connection lost', $e->getMessage());
		}

		$this->assertSame([], $this->deleted);
	}

	public function testHasAName(): void {
		$this->assertNotSame('', $this->step(new FakeAppRemoval([]))->getName());
	}
}
