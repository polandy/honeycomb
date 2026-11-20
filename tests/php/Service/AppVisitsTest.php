<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\AppVisits;
use OCP\Config\IUserConfig;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

final class AppVisitsTest extends TestCase {
	/** @var array<string, bool> the stored values by user id */
	private array $stored = [];
	private int $writes = 0;

	private function visits(): AppVisits {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueBool')->willReturnCallback(fn (string $userId, string $app, string $key): bool => $app === 'honeycomb' && $key === 'opened' && ($this->stored[$userId] ?? false));
		$config->method('setValueBool')->willReturnCallback(function (string $userId, string $app, string $key, bool $value): bool {
			$this->writes++;
			$this->stored[$userId] = $app === 'honeycomb' && $key === 'opened' && $value;
			return true;
		});
		return new AppVisits($config);
	}

	private function user(string $userId): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($userId);
		return $user;
	}

	// spec: IMAGES-001.16
	public function testRemembersWhoOpenedHoneycombAndWritesOnlyOnTheFirstVisit(): void {
		$visits = $this->visits();

		$visits->record($this->user('alice'));
		$visits->record($this->user('alice'));

		$this->assertTrue($visits->opened('alice'));
		$this->assertSame(1, $this->writes);
	}

	// spec: IMAGES-001.17
	public function testAUserWhoNeverOpenedHoneycombHasNotOpenedIt(): void {
		$this->assertFalse($this->visits()->opened('bob'));
	}
}
