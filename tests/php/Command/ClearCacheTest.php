<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Command\ClearCache;
use OCA\Honeycomb\Service\CacheClear;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use OCA\Honeycomb\Tests\Service\XmpCacheRowTest;
use OCP\IUserManager;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class ClearCacheTest extends TestCase {
	private FakeXmpCacheStore $xmpCache;
	private FakeVisualHashStore $visualHashes;

	#[\Override]
	protected function setUp(): void {
		$row = XmpCacheRow::fromRequest(XmpCacheRowTest::item());
		$hash = new VisualHash(7, 'etag-7', 1, '00ff00ff00ff00ff');
		$this->xmpCache = new FakeXmpCacheStore();
		$this->xmpCache->rows = ['alice' => [9 => $row, 10 => $row], 'bob' => [9 => $row]];
		$this->visualHashes = new FakeVisualHashStore();
		$this->visualHashes->rows = [7 => $hash, 8 => $hash];
	}

	private function command(): ClearCache {
		$users = $this->createStub(IUserManager::class);
		$users->method('userExists')->willReturnCallback(static fn (string $uid): bool => in_array($uid, ['alice', 'bob'], true));
		return new ClearCache(new CacheClear($this->xmpCache, $this->visualHashes, new FakeQualityStore()), $users);
	}

	private function tester(): CommandTester {
		return new CommandTester($this->command());
	}

	// spec: XMP-006.6
	public function testIsNamedForOcc(): void {
		$this->assertSame('honeycomb:cache:clear', $this->command()->getName());
	}

	// spec: XMP-006.6
	public function testClearsOneUserThenEveryUser(): void {
		$tester = $this->tester();

		$this->assertSame(Command::SUCCESS, $tester->execute(['user' => 'alice']));
		$this->assertStringContainsString('Removed 2 cache rows of alice.', $tester->getDisplay());
		$this->assertSame(['bob'], array_keys($this->xmpCache->rows));
		$this->assertSame([7, 8], array_keys($this->visualHashes->rows));

		$this->assertSame(Command::SUCCESS, $tester->execute([]));
		$this->assertStringContainsString('Removed 3 cache rows of every user.', $tester->getDisplay());
		$this->assertSame([], $this->xmpCache->rows);
		$this->assertSame([], $this->visualHashes->rows);
	}

	// spec: XMP-006.6
	public function testAnUnknownUserFailsAndRemovesNothing(): void {
		$tester = $this->tester();

		$this->assertSame(Command::FAILURE, $tester->execute(['user' => 'carol']));
		$this->assertStringContainsString('Unknown user: carol', $tester->getDisplay());
		$this->assertCount(2, $this->xmpCache->rows);
		$this->assertCount(2, $this->visualHashes->rows);
	}
}
