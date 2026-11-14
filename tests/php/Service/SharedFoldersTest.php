<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SharedFolders;
use OCP\Files\Config\ICachedMountInfo;
use OCP\Files\Config\IUserMountCache;
use OCP\Files\Folder;
use OCP\Files\Mount\IMountPoint;
use OCP\Files\Node;
use OCP\IUser;
use OCP\Share\IManager as IShareManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SharedFoldersTest extends TestCase {
	private const STORAGE_ID = 7;

	/** @return array<string, array{array<string, mixed>, string, list<string>, bool}> */
	public static function accessLists(): array {
		return [
			'the user only' => [['users' => ['alice'], 'remote' => false, 'public' => false, 'mail' => []], '', ['alice'], false],
			'no shares at all' => [[], '', [], false],
			'shared with another user' => [['users' => ['alice', 'bob'], 'remote' => false], '', [], true],
			'shared with a federated user' => [['users' => ['alice'], 'remote' => true], '', [], true],
			'shared by public link' => [['users' => ['alice'], 'public' => true], '', [], true],
			'shared by mail' => [['users' => ['alice'], 'mail' => ['carol@example.com']], '', [], true],
			'in a group folder' => [[], 'group', [], true],
			'on external storage of the user only' => [[], 'external', ['alice'], false],
			'on external storage mounted for several users' => [[], 'external', ['alice', 'bob'], true],
			'another mount type mounted for several users' => [[], '', ['alice', 'bob'], false],
		];
	}

	// spec: LISTING-001.12
	/** @param list<string> $mountedFor */
	#[DataProvider('accessLists')]
	public function testAFolderIsSharedWhenAnotherUserHasAccess(array $accessList, string $mountType, array $mountedFor, bool $shared): void {
		$user = $this->userNamed('alice');
		$mount = $this->createStub(IMountPoint::class);
		$mount->method('getMountType')->willReturn($mountType);
		$mount->method('getNumericStorageId')->willReturn(self::STORAGE_ID);
		$folder = $this->createStub(Folder::class);
		$folder->method('getMountPoint')->willReturn($mount);
		$shares = $this->createStub(IShareManager::class);
		$shares->method('getAccessList')->willReturnCallback(function (Node $node, bool $recursive = true, bool $currentAccess = false) use ($folder, $accessList): array {
			$this->assertSame([$folder, true, false], [$node, $recursive, $currentAccess]);
			return $accessList;
		});
		$mounts = $this->createStub(IUserMountCache::class);
		$mounts->method('getMountsForStorageId')->willReturnCallback(function (int $storageId) use ($mountedFor): array {
			$this->assertSame(self::STORAGE_ID, $storageId);
			return array_map(fn (string $uid): ICachedMountInfo => $this->mountFor($uid), $mountedFor);
		});

		$this->assertSame($shared, (new SharedFolders($shares, $mounts))->isShared($user, $folder));
	}

	// spec: LISTING-001.12
	public function testAFolderSharedWithTheUserIsSharedWithoutAskingTheShareManager(): void {
		$mount = $this->createStub(IMountPoint::class);
		$mount->method('getMountType')->willReturn('shared');
		$folder = $this->createStub(Folder::class);
		$folder->method('getMountPoint')->willReturn($mount);
		$shares = $this->createMock(IShareManager::class);
		$shares->expects($this->never())->method($this->anything());
		$mounts = $this->createMock(IUserMountCache::class);
		$mounts->expects($this->never())->method($this->anything());

		$this->assertTrue((new SharedFolders($shares, $mounts))->isShared($this->userNamed('alice'), $folder));
	}

	private function userNamed(string $uid): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	private function mountFor(string $uid): ICachedMountInfo {
		$mount = $this->createStub(ICachedMountInfo::class);
		$mount->method('getUser')->willReturn($this->userNamed($uid));
		return $mount;
	}
}
