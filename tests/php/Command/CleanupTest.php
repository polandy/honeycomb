<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Command\Cleanup;
use OCA\Honeycomb\Service\AppData;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\OrphanedFlags;
use OCA\Honeycomb\Tests\Service\FakeExistingFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class CleanupTest extends TestCase {
	private function command(?AppData $data = null): Cleanup {
		$store = new FakeFlagStore();
		$store->rows = [7 => new FileFlag(7, Flag::Picked, false, 100), 8 => new FileFlag(8, Flag::Rejected, true, 100), 9 => new FileFlag(9, Flag::Unflagged, false, 100)];
		$files = new FakeExistingFiles();
		$files->vanished = [7];
		$files->trashed = [8];
		return new Cleanup(new OrphanedFlags($store, $files), $data ?? new FakeAppData([]));
	}

	// spec: DECISIONS-001.32
	public function testIsNamedForOcc(): void {
		$this->assertSame('honeycomb:cleanup', $this->command()->getName());
	}

	// spec: DECISIONS-001.32
	public function testPrintsHowManyRowsItRemovedAndNoneTheSecondTime(): void {
		$tester = new CommandTester($this->command());

		$this->assertSame(Command::SUCCESS, $tester->execute([]));
		$this->assertStringContainsString('Removed 2 orphaned flag rows.', $tester->getDisplay());
		$this->assertSame(Command::SUCCESS, $tester->execute([]));
		$this->assertStringContainsString('Removed 0 orphaned flag rows.', $tester->getDisplay());
	}

	private function data(): FakeAppData {
		return new FakeAppData(['honeycomb_flags' => 5, 'honeycomb_hashes' => 2, 'preferences' => 0]);
	}

	// spec: DECISIONS-001.35
	public function testDryRunCountsEveryTableAndDeletesNothing(): void {
		$data = $this->data();
		$tester = new CommandTester($this->command($data));

		$this->assertSame(Command::SUCCESS, $tester->execute(['--all' => true, '--dry-run' => true]));
		$this->assertStringContainsString('honeycomb_flags: 5', $tester->getDisplay());
		$this->assertStringContainsString('honeycomb_hashes: 2', $tester->getDisplay());
		$this->assertStringContainsString('Dry run', $tester->getDisplay());
		$this->assertSame(5, $data->rows['honeycomb_flags']);
	}

	// spec: DECISIONS-001.35
	public function testAllEmptiesEveryTableAndPrintsWhatWent(): void {
		$data = $this->data();
		$tester = new CommandTester($this->command($data));

		$this->assertSame(Command::SUCCESS, $tester->execute(['--all' => true]));
		$this->assertStringContainsString('honeycomb_flags: 5', $tester->getDisplay());
		$this->assertStringContainsString('Removed 7 rows.', $tester->getDisplay());
		$this->assertSame(['honeycomb_flags' => 0, 'honeycomb_hashes' => 0, 'preferences' => 0], $data->rows);
	}

	// spec: DECISIONS-001.35
	public function testAllNamesADatabaseFailureAndFails(): void {
		$data = $this->data();
		$data->failure = new \RuntimeException('connection lost');
		$tester = new CommandTester($this->command($data));

		$this->assertSame(Command::FAILURE, $tester->execute(['--all' => true]));
		$this->assertStringContainsString('connection lost', $tester->getDisplay());
		$this->assertStringNotContainsString('Removed', $tester->getDisplay());
	}

	// spec: DECISIONS-001.35
	public function testDryRunWithoutAllRefusesAndRemovesNothing(): void {
		$data = $this->data();
		$tester = new CommandTester($this->command($data));

		$this->assertSame(Command::FAILURE, $tester->execute(['--dry-run' => true]));
		$this->assertStringContainsString('--all', $tester->getDisplay());
		$this->assertSame(5, $data->rows['honeycomb_flags']);
		$this->assertStringNotContainsString('Removed', $tester->getDisplay());
	}
}
