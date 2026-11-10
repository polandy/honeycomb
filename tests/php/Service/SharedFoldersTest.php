<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SharedFolders;
use OCP\Files\Folder;
use OCP\Files\Mount\IMountPoint;
use OCP\Files\Node;
use OCP\IUser;
use OCP\Share\IManager as IShareManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SharedFoldersTest extends TestCase {
	/** @return array<string, array{array<string, mixed>, string, bool}> */
	public static function accessLists(): array {
		return [
			'the user only' => [['users' => ['alice'], 'remote' => false, 'public' => false], '', false],
			'no shares at all' => [[], '', false],
			'shared with another user' => [['users' => ['alice', 'bob'], 'remote' => false], '', true],
			'received from another user' => [['users' => ['bob', 'alice']], 'shared', true],
			'shared with a federated user' => [['users' => ['alice'], 'remote' => true], '', true],
			'a public link only' => [['users' => ['alice'], 'public' => true, 'mail' => ['carol@example.com']], '', false],
			'in a group folder' => [[], 'group', true],
		];
	}

	// spec: LISTING-001.12
	#[DataProvider('accessLists')]
	public function testAFolderIsSharedWhenAnotherUserHasAccess(array $accessList, string $mountType, bool $shared): void {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$mount = $this->createStub(IMountPoint::class);
		$mount->method('getMountType')->willReturn($mountType);
		$folder = $this->createStub(Folder::class);
		$folder->method('getMountPoint')->willReturn($mount);
		$shares = $this->createStub(IShareManager::class);
		$shares->method('getAccessList')->willReturnCallback(function (Node $node, bool $recursive = true, bool $currentAccess = false) use ($folder, $accessList): array {
			$this->assertSame([$folder, true, false], [$node, $recursive, $currentAccess]);
			return $accessList;
		});

		$this->assertSame($shared, (new SharedFolders($shares))->isShared($user, $folder));
	}
}
