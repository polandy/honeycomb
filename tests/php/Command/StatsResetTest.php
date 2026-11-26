<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Command\StatsReset;
use OCA\Honeycomb\Service\Stats\StatsReset as StatsResetService;
use OCA\Honeycomb\Tests\Service\FakeStatsStore;
use OCP\IUserManager;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class StatsResetTest extends TestCase {
	private FakeStatsStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeStatsStore();
		$this->store->rows = [
			'alice' => ['2026-02-01' => ['series_done' => 1, 'trash_files' => 2], '2026-02-10' => ['trash_files' => 4]],
			'bob' => ['2026-02-10' => ['series_done' => 9]],
		];
	}

	private function command(): StatsReset {
		$users = $this->createStub(IUserManager::class);
		$users->method('userExists')->willReturnCallback(static fn (string $uid): bool => in_array($uid, ['alice', 'bob', 'carol'], true));
		return new StatsReset(new StatsResetService($this->store), $users);
	}

	private function tester(): CommandTester {
		return new CommandTester($this->command());
	}

	// spec: STATS-001.3
	public function testIsNamedForOcc(): void {
		$this->assertSame('honeycomb:stats:reset', $this->command()->getName());
	}

	// spec: STATS-001.3
	public function testAYesDeletesOneUsersRowsAndPrintsWhatWent(): void {
		$tester = $this->tester();
		$tester->setInputs(['yes']);

		$this->assertSame(Command::SUCCESS, $tester->execute(['user' => 'alice']));

		$this->assertStringContainsString('Delete 3 statistics rows of alice?', $tester->getDisplay());
		$this->assertStringContainsString('alice: 3 rows', $tester->getDisplay());
		$this->assertStringContainsString('Deleted 3 statistics rows of 1 user.', $tester->getDisplay());
		$this->assertSame(['bob'], array_keys($this->store->rows));
	}

	// spec: STATS-001.3
	public function testANoDeletesNothing(): void {
		$tester = $this->tester();
		$tester->setInputs(['no']);

		$this->assertSame(Command::SUCCESS, $tester->execute(['--all' => true]));

		$this->assertStringContainsString('Delete 4 statistics rows of every user?', $tester->getDisplay());
		$this->assertStringContainsString('Aborted, nothing was deleted.', $tester->getDisplay());
		$this->assertSame(['alice', 'bob'], array_keys($this->store->rows));
	}

	// spec: STATS-001.3
	public function testForceDeletesEveryUsersRowsWithoutAsking(): void {
		$tester = $this->tester();

		$this->assertSame(Command::SUCCESS, $tester->execute(['--all' => true, '--force' => true], ['interactive' => false]));

		$this->assertStringNotContainsString('?', $tester->getDisplay());
		$this->assertStringContainsString('alice: 3 rows', $tester->getDisplay());
		$this->assertStringContainsString('bob: 1 row', $tester->getDisplay());
		$this->assertStringContainsString('Deleted 4 statistics rows of 2 users.', $tester->getDisplay());
		$this->assertSame([], $this->store->rows);
	}

	// spec: STATS-001.3
	public function testDryRunPrintsTheCountsAndNeitherAsksNorDeletes(): void {
		$tester = $this->tester();

		$this->assertSame(Command::SUCCESS, $tester->execute(['--all' => true, '--dry-run' => true]));

		$this->assertStringContainsString('alice: 3 rows', $tester->getDisplay());
		$this->assertStringContainsString('Dry run: 4 statistics rows of 2 users would be deleted, nothing was deleted.', $tester->getDisplay());
		$this->assertStringNotContainsString('Delete 4', $tester->getDisplay());
		$this->assertCount(2, $this->store->rows);
	}

	// spec: STATS-001.3
	public function testWithoutATerminalAndWithoutForceNothingIsDeleted(): void {
		$tester = $this->tester();

		$this->assertSame(Command::FAILURE, $tester->execute(['user' => 'alice'], ['interactive' => false]));

		$this->assertStringContainsString('Cannot ask without a terminal; add --force to delete.', $tester->getDisplay());
		$this->assertCount(2, $this->store->rows);
	}

	// spec: STATS-001.3
	public function testAnUnknownUserFailsAndDeletesNothing(): void {
		$tester = $this->tester();

		$this->assertSame(Command::FAILURE, $tester->execute(['user' => 'mallory', '--force' => true]));

		$this->assertStringContainsString('Unknown user: mallory', $tester->getDisplay());
		$this->assertCount(2, $this->store->rows);
	}

	// spec: STATS-001.3
	public function testAUserWithoutRowsHasNothingToDelete(): void {
		$tester = $this->tester();

		$this->assertSame(Command::SUCCESS, $tester->execute(['user' => 'carol']));

		$this->assertStringContainsString('Nothing to delete: carol has no statistics.', $tester->getDisplay());
		$this->assertStringNotContainsString('Delete 0', $tester->getDisplay());
		$this->assertCount(2, $this->store->rows);
	}

	// spec: STATS-001.3
	public function testEveryUserWithoutAnyRowsHasNothingToDelete(): void {
		$this->store->rows = [];
		$tester = $this->tester();

		$this->assertSame(Command::SUCCESS, $tester->execute(['--all' => true]));

		$this->assertStringContainsString('Nothing to delete: no user has statistics.', $tester->getDisplay());
	}

	// spec: STATS-001.3
	public function testNeitherOrBothOfAUserAndAllFailAndDeleteNothing(): void {
		$tester = $this->tester();

		$this->assertSame(Command::FAILURE, $tester->execute(['--force' => true]));
		$this->assertStringContainsString('Name one user or pass --all.', $tester->getDisplay());
		$this->assertSame(Command::FAILURE, $tester->execute(['user' => 'alice', '--all' => true, '--force' => true]));
		$this->assertStringContainsString('Name one user or pass --all, not both.', $tester->getDisplay());
		$this->assertCount(2, $this->store->rows);
	}
}
