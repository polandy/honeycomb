<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileVersions;
use OCA\Honeycomb\Service\VersionBackends;
use OCP\App\IAppManager;
use OCP\Files\Folder;
use OCP\Files\Mount\IMountPoint;
use OCP\Files\Storage\IStorage;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

final class FileVersionsTest extends TestCase {
	private IStorage $storage;
	private IStorage $foreignStorage;

	#[\Override]
	protected function setUp(): void {
		$this->storage = $this->createStub(IStorage::class);
		$this->foreignStorage = $this->createStub(IStorage::class);
	}

	/** A check where `bob` has `files_versions` off and only `$this->storage` has a versions backend. */
	private function versions(): FileVersions {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app, ?IUser $user): bool => $app === 'files_versions' && $user?->getUID() !== 'bob');
		$backends = $this->createStub(VersionBackends::class);
		$backends->method('existFor')->willReturnCallback(fn (IStorage $storage): bool => $storage === $this->storage);
		return new FileVersions($apps, $backends);
	}

	private function node(?string $owner = 'alice', ?IStorage $storage = null, string $mountType = ''): Folder {
		$mount = $this->createStub(IMountPoint::class);
		$mount->method('getMountType')->willReturn($mountType);
		$user = null;
		if ($owner !== null) {
			$user = $this->createStub(IUser::class);
			$user->method('getUID')->willReturn($owner);
		}
		$folder = $this->createStub(Folder::class);
		$folder->method('getMountPoint')->willReturn($mount);
		$folder->method('getOwner')->willReturn($user);
		$folder->method('getStorage')->willReturn($storage ?? $this->storage);
		return $folder;
	}

	// spec: LISTING-001.15, XMP-002.10
	public function testAnOwnFolderWithABackendKeepsVersions(): void {
		$this->assertTrue($this->versions()->keeps($this->node()));
	}

	// spec: LISTING-001.15, XMP-002.10
	public function testAFolderWhoseOwnerHasVersionsOffKeepsNone(): void {
		$this->assertFalse($this->versions()->keeps($this->node('bob')));
	}

	// spec: LISTING-001.15, XMP-002.10
	public function testAStorageWithoutAVersionsBackendKeepsNone(): void {
		$this->assertFalse($this->versions()->keeps($this->node(storage: $this->foreignStorage)));
	}

	// spec: LISTING-001.15, XMP-002.10
	public function testExternalStorageKeepsNone(): void {
		$this->assertFalse($this->versions()->keeps($this->node(mountType: 'external')));
	}

	// spec: LISTING-001.15
	public function testANodeWithoutOwnerKeepsNone(): void {
		$this->assertFalse($this->versions()->keeps($this->node(null)));
	}
}
