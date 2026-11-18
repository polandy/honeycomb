<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SharedFolderLookup;
use OCA\Honeycomb\Service\SharedFolders;
use OCP\Files\Config\ICachedMountInfo;
use OCP\Files\Config\IUserMountCache;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\IUser;
use OCP\Share\IManager as IShareManager;
use OCP\Share\IShare;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SharedFoldersTest extends TestCase {
	use FakeFiles;

	/** @var array<int, array<string, mixed>> access lists by file id; each of these files carries a share */
	private array $accessLists = [];
	/** @var list<string> the users the external storage is mounted for */
	private array $mountedFor = [];
	/** @var list<int> the storages whose mounts were asked for */
	private array $mountLookups = [];
	/** @var list<int> the share types whose shares were read */
	private array $shareTypesRead = [];
	/** @var list<array{string, bool, bool}> the access lists read: folder path, recursive, current access */
	private array $accessListsRead = [];

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
	/**
	 * @param array<string, mixed> $accessList
	 * @param list<string> $mountedFor
	 */
	#[DataProvider('accessLists')]
	public function testAFolderIsSharedWhenAnotherUserHasAccess(array $accessList, string $mountType, array $mountedFor, bool $shared): void {
		$this->accessLists = $accessList === [] ? [] : [10 => $accessList];
		$this->mountedFor = $mountedFor;

		$this->assertSame($shared, $this->lookup()->isShared($this->folder('/Photos', mountType: $mountType, fileId: 10)));
		$this->assertSame($accessList === [] ? [] : [['/Photos', false, false]], $this->accessListsRead);
	}

	// spec: LISTING-001.12
	public function testAFolderSharedWithTheUserIsSharedWithoutAskingTheShareManager(): void {
		$shares = $this->createMock(IShareManager::class);
		$shares->expects($this->never())->method($this->anything());
		$mounts = $this->createMock(IUserMountCache::class);
		$mounts->expects($this->never())->method($this->anything());

		$lookup = (new SharedFolders($shares, $mounts))->lookup($this->user(), $this->folder(''));

		$this->assertTrue($lookup->isShared($this->folder('/Photos', mountType: 'shared')));
	}

	// spec: LISTING-001.17
	public function testReadsTheSharesOnceForAHundredFoldersWithoutAShare(): void {
		$this->accessLists = [99 => ['users' => ['alice', 'bob']]];
		$lookup = $this->lookup();
		$photos = $this->folder('/Photos', fileId: 2);

		foreach (range(1, 100) as $day) {
			$this->assertFalse($lookup->isShared($this->folder("/Photos/d$day", fileId: 100 + $day, parent: fn (): Folder => $photos)));
		}
		$this->assertSame(array_values(array_unique($this->shareTypesRead)), $this->shareTypesRead);
		$this->assertContains(IShare::TYPE_USER, $this->shareTypesRead);
		$this->assertSame([], $this->accessListsRead);
		$this->assertSame([], $this->mountLookups);
	}

	// spec: LISTING-001.17
	public function testEveryFolderBelowASharedFolderIsSharedAfterOneAccessList(): void {
		$this->accessLists = [2 => ['users' => ['alice', 'bob']]];
		$lookup = $this->lookup();
		$photos = $this->folder('/Photos', fileId: 2);
		$year = $this->folder('/Photos/2024', fileId: 3, parent: fn (): Folder => $photos);

		$this->assertTrue($lookup->isShared($this->folder('/Photos/2024/Trip', fileId: 4, parent: fn (): Folder => $year)));
		$this->assertTrue($lookup->isShared($this->folder('/Photos/2024/Home', fileId: 5, parent: fn (): Folder => $year)));
		$this->assertTrue($lookup->isShared($year));
		$this->assertSame([['/Photos', false, false]], $this->accessListsRead);
	}

	// spec: LISTING-001.17
	public function testAShareThatGivesNobodyElseAccessLeavesTheFoldersBelowUnshared(): void {
		$this->accessLists = [2 => ['users' => ['alice']]];
		$lookup = $this->lookup();
		$photos = $this->folder('/Photos', fileId: 2);

		$this->assertFalse($lookup->isShared($this->folder('/Photos/2024', fileId: 3, parent: fn (): Folder => $photos)));
		$this->assertFalse($lookup->isShared($this->folder('/Photos/2025', fileId: 4, parent: fn (): Folder => $photos)));
		$this->assertSame([['/Photos', false, false]], $this->accessListsRead);
	}

	// spec: LISTING-001.17
	public function testAsksForTheMountsOfAnExternalStorageOnce(): void {
		$this->mountedFor = ['alice', 'bob'];
		$lookup = $this->lookup();

		$this->assertTrue($lookup->isShared($this->folder('/Ext/a', mountType: 'external')));
		$this->assertTrue($lookup->isShared($this->folder('/Ext/b', mountType: 'external')));
		$this->assertCount(1, $this->mountLookups);
	}

	private function lookup(): SharedFolderLookup {
		$shares = $this->createStub(IShareManager::class);
		$shares->method('getSharesBy')->willReturnCallback(function (string $uid, int $type, ?Node $path, bool $reshares, int $limit, int $offset, bool $onlyValid): array {
			$this->assertSame(['alice', null, true, -1, 0, false], [$uid, $path, $reshares, $limit, $offset, $onlyValid]);
			$this->shareTypesRead[] = $type;
			return $type === IShare::TYPE_USER ? array_map($this->shareOf(...), array_keys($this->accessLists)) : [];
		});
		$shares->method('getAccessList')->willReturnCallback(function (Node $node, bool $recursive = true, bool $currentAccess = false): array {
			$this->accessListsRead[] = [$this->below($node), $recursive, $currentAccess];
			return $this->accessLists[$node->getId()] ?? [];
		});
		$mounts = $this->createStub(IUserMountCache::class);
		$mounts->method('getMountsForStorageId')->willReturnCallback(function (int $storageId): array {
			$this->mountLookups[] = $storageId;
			return array_map(fn (string $uid): ICachedMountInfo => $this->mountFor($uid), $this->mountedFor);
		});
		return (new SharedFolders($shares, $mounts))->lookup($this->user(), $this->folder(''));
	}

	private function shareOf(int $fileId): IShare {
		$share = $this->createStub(IShare::class);
		$share->method('getNodeId')->willReturn($fileId);
		return $share;
	}

	private function mountFor(string $uid): ICachedMountInfo {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		$mount = $this->createStub(ICachedMountInfo::class);
		$mount->method('getUser')->willReturn($user);
		return $mount;
	}
}
