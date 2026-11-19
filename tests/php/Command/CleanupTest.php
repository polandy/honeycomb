<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Command\Cleanup;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\OrphanedFlags;
use OCA\Honeycomb\Tests\Service\FakeExistingFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class CleanupTest extends TestCase {
	private function command(): Cleanup {
		$store = new FakeFlagStore();
		$store->rows = [7 => new FileFlag(7, Flag::Picked, false, 100), 8 => new FileFlag(8, Flag::Rejected, true, 100), 9 => new FileFlag(9, Flag::Unflagged, false, 100)];
		$files = new FakeExistingFiles();
		$files->vanished = [7];
		$files->trashed = [8];
		return new Cleanup(new OrphanedFlags($store, $files));
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
}
