<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\TrashBinGuard;
use OCP\Config\IUserConfig;
use OCP\Files\File;
use OCP\Files\Storage\IStorage;
use OCP\IAppConfig;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class TrashBinGuardTest extends TestCase {
	/** A file of `$owner` of `$size` bytes on a storage that is each of `$storages`. */
	private function file(int $size, array $storages = ['OCA\Files_Trashbin\Storage'], ?string $owner = 'bob'): File {
		$storage = $this->createStub(IStorage::class);
		$storage->method('instanceOfStorage')->willReturnCallback(static fn (string $class): bool => in_array($class, $storages, true));
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn((string)$owner);
		$file = $this->createStub(File::class);
		$file->method('getSize')->willReturn($size);
		$file->method('getStorage')->willReturn($storage);
		$file->method('getOwner')->willReturn($owner === null ? null : $user);
		return $file;
	}

	/** @param array<string, string> $userSizes the trash bin size per user id */
	private function guard(array $userSizes = [], string $serverSize = '-1'): TrashBinGuard {
		$userConfig = $this->createStub(IUserConfig::class);
		$userConfig->method('getValueString')->willReturnCallback(
			static fn (string $user, string $app, string $key, string $default): string => $app === 'files_trashbin' && $key === 'trashbin_size' ? ($userSizes[$user] ?? $default) : $default,
		);
		$appConfig = $this->createStub(IAppConfig::class);
		$appConfig->method('getValueString')->willReturnCallback(
			static fn (string $app, string $key, string $default): string => $app === 'files_trashbin' && $key === 'trashbin_size' ? $serverSize : $default,
		);
		return new TrashBinGuard($userConfig, $appConfig);
	}

	// spec: DELETE-001.9
	public function testKeepsAFileOnATrashBinStorageWithoutASizeLimit(): void {
		$this->assertTrue($this->guard()->keeps('alice', $this->file(10_000_000)));
	}

	// spec: DELETE-001.9
	public function testRefusesAFileOnAStorageTheTrashBinDoesNotWrap(): void {
		$this->assertFalse($this->guard()->keeps('alice', $this->file(1, storages: [])));
	}

	/** @return array<string, array{array<string, string>, string, int, bool}> */
	public static function sizeLimits(): array {
		return [
			'smaller than the server limit' => [[], '100', 99, true],
			'as large as the server limit' => [[], '100', 100, false],
			'the owner\'s limit before the server\'s' => [['bob' => '1000'], '100', 500, true],
			'the owner\'s smaller limit' => [['bob' => '10'], '-1', 50, false],
			'no limit from a non-numeric server value' => [[], 'lots', 50, true],
			'the server limit when the owner\'s is unset' => [['bob' => '-1'], '10', 50, false],
		];
	}

	/** @param array<string, string> $userSizes */
	// spec: DELETE-001.9
	#[DataProvider('sizeLimits')]
	public function testRefusesAFileAtLeastAsLargeAsTheOwnersTrashBinSize(array $userSizes, string $serverSize, int $size, bool $kept): void {
		$this->assertSame($kept, $this->guard($userSizes, $serverSize)->keeps('alice', $this->file($size)));
	}

	// spec: DELETE-001.9
	public function testReadsTheUsersLimitForAFileWithoutAnOwner(): void {
		$this->assertFalse($this->guard(['alice' => '10'])->keeps('alice', $this->file(50, owner: null)));
	}

	// spec: DELETE-001.9
	public function testATeamFolderKeepsAFileOfAnySize(): void {
		$file = $this->file(50, ['OCA\Files_Trashbin\Storage', 'OCA\GroupFolders\Mount\GroupFolderStorage']);

		$this->assertTrue($this->guard(serverSize: '10')->keeps('alice', $file));
	}
}
