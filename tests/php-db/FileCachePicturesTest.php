<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\FileCachePictures;
use OCA\Honeycomb\Db\SubtreeExactness;
use OCA\Honeycomb\Domain\PairingExtensions;
use OCP\Files\Folder;
use OCP\Files\IMimeTypeLoader;
use OCP\Files\IRootFolder;
use OCP\Files\Mount\IMountManager;
use OCP\Files\Mount\IMountPoint;
use OCP\Files\Storage\IStorage;
use OCP\IUserManager;
use OCP\Server;
use PHPUnit\Framework\Attributes\Group;

/** The pictures and orphaned sidecars below a folder, counted in Nextcloud's file cache of real users' files; part of the ADR 0049 canary. */
#[Group('canary')]
final class FileCachePicturesTest extends DbTestCase {
	private const string USER = 'honeycomb-count';
	private const string OTHER = 'honeycomb-count-other';
	private const string PASSWORD = 'honeycomb-count-Passw0rd-long!';

	private IUserManager $users;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->users = Server::get(IUserManager::class);
		foreach ([self::USER, self::OTHER] as $uid) {
			$this->users->get($uid)?->delete();
			$this->users->createUser($uid, self::PASSWORD);
		}
	}

	#[\Override]
	protected function tearDown(): void {
		foreach ([self::USER, self::OTHER] as $uid) {
			$this->users->get($uid)?->delete();
		}
		parent::tearDown();
	}

	/** @param list<IMountPoint> $mounts */
	private function counter(array $mounts = []): FileCachePictures {
		$manager = $this->createStub(IMountManager::class);
		$manager->method('findIn')->willReturn($mounts);
		return new FileCachePictures($this->db, Server::get(IMimeTypeLoader::class), $manager);
	}

	/**
	 * Creates the files at `$paths` in the user's files, with their folders.
	 * @param list<string> $paths
	 */
	private function files(string $uid, array $paths): Folder {
		$home = Server::get(IRootFolder::class)->getUserFolder($uid);
		foreach ($paths as $path) {
			$this->folderAt($home, dirname($path))->newFile(basename($path), 'x');
		}
		return $home;
	}

	private function folderAt(Folder $home, string $path): Folder {
		$folder = $home;
		foreach (array_filter(explode('/', $path), static fn (string $name): bool => $name !== '' && $name !== '.') as $name) {
			$next = $folder->nodeExists($name) ? $folder->get($name) : $folder->newFolder($name);
			assert($next instanceof Folder);
			$folder = $next;
		}
		return $folder;
	}

	private function mount(string $mountPoint, int $rootId, ?IStorage $storage = null): IMountPoint {
		$mount = $this->createStub(IMountPoint::class);
		$mount->method('getStorage')->willReturn($storage);
		$mount->method('getMountPoint')->willReturn($mountPoint);
		$mount->method('getStorageRootId')->willReturn($rootId);
		return $mount;
	}

	// spec: LISTING-003.20
	public function testCountsThePicturesOfAFolderAndAllItsSubfolders(): void {
		$home = $this->files(self::USER, [
			'Photos/a.jpg', 'Photos/b.CR3', 'Photos/b.xmp', 'Photos/notes.txt', 'Photos/.c.jpg',
			'Photos/.thumbnails/d.jpg', 'Photos/2024/.e.jpg', 'Photos/2024/e.jpg', 'Photos/2024/Trip/f.png', 'Other/g.jpg',
		]);

		$this->assertSame(3, $this->counter()->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults())?->pictures);
		$this->assertSame(1, $this->counter()->count($this->folderAt($home, 'Photos/2024'), PairingExtensions::defaults())?->pictures);
	}

	// spec: LISTING-003.24
	public function testCountsAndPairsByTheGivenExtensions(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg', 'Photos/a.nef', 'Photos/2024/b.tif', 'Photos/2024/c.cr2', 'Photos/2024/c.tif', 'Photos/2024/d.png']);
		$photos = $this->folderAt($home, 'Photos');

		$this->assertSame(2, $this->counter()->count($photos, PairingExtensions::defaults())?->pictures);
		$this->assertSame(3, $this->counter()->count($photos, PairingExtensions::fromRequest(['cr2'], ['jpg', 'tif']))?->pictures);
	}

	// spec: LISTING-003.20
	public function testCountsAPairOnceAndOnlyWithinOneFolder(): void {
		$home = $this->files(self::USER, [
			'Photos/a.jpg', 'Photos/A.CR2', 'Photos/b.jpg', 'Photos/b.cr3', 'Photos/b.CR3.xmp',
			'Photos/2024/a.dng', 'Photos/2024/c.JPG', 'Photos/2024/c.heic', 'Photos/2024/.d.jpg', 'Photos/2024/.d.dng',
		]);

		$this->assertSame(5, $this->counter()->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults())?->pictures);
		$this->assertSame(3, $this->counter()->count($this->folderAt($home, 'Photos/2024'), PairingExtensions::defaults())?->pictures);
	}

	// spec: LISTING-003.23
	public function testCountsTheOrphanedSidecarsFolderByFolder(): void {
		$home = $this->files(self::USER, [
			'Photos/a.jpg', 'Photos/a.jpg.xmp', 'Photos/b.xmp', 'Photos/clip.mp4', 'Photos/clip.mp4.xmp',
			'Photos/2024/c.xmp', 'Photos/2024/a.xmp', 'Photos/2024/.h.xmp', 'Photos/.thumbs/z.xmp', 'Other/y.xmp',
		]);

		$this->assertSame(3, $this->counter()->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults())?->orphans);
		$this->assertSame(2, $this->counter()->count($this->folderAt($home, 'Photos/2024'), PairingExtensions::defaults())?->orphans);
	}

	// spec: LISTING-003.20
	public function testCountsNoSiblingThatSharesThePrefixOrMatchesItAsAPattern(): void {
		$home = $this->files(self::USER, ['Day/a.jpg', 'Day 2/b.jpg', 'Day_1/c.jpg', 'DayA1/d.jpg', '100%/e.jpg', '1000/f.jpg']);

		$this->assertSame(1, $this->counter()->count($this->folderAt($home, 'Day'), PairingExtensions::defaults())?->pictures);
		$this->assertSame(1, $this->counter()->count($this->folderAt($home, 'Day_1'), PairingExtensions::defaults())?->pictures);
		$this->assertSame(1, $this->counter()->count($this->folderAt($home, '100%'), PairingExtensions::defaults())?->pictures);
	}

	// spec: LISTING-003.20
	public function testAddsTheStoragesMountedBelowExceptHiddenUnscannedOrAlreadyCountedOnes(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg', 'Photos/2024/b.jpg']);
		$other = $this->files(self::OTHER, ['Holiday/c.jpg', 'Holiday/Day/d.jpg', 'Holiday/.e.jpg', 'Holiday/x.txt']);
		$below = '/' . self::USER . '/files/Photos';
		$holiday = $this->folderAt($other, 'Holiday')->getId();

		$count = $this->counter([
			$this->mount("$below/Shared/", $holiday),
			$this->mount("$below/.hidden/Shared/", $holiday),
			$this->mount("$below/Unscanned/", -1),
			$this->mount("$below/Again/", $this->folderAt($home, 'Photos/2024')->getId()),
		])->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults());

		$this->assertSame(4, $count?->pictures);
		$this->assertTrue($count?->approximate);
	}

	// spec: LISTING-003.20
	public function testACompletelyScannedPlainFolderIsExact(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg', 'Photos/2024/b.jpg']);
		$holiday = $this->files(self::OTHER, ['Holiday/c.jpg']);
		$below = '/' . self::USER . '/files/Photos';

		$plain = $this->counter()->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults());
		$mounted = $this->counter([$this->mount("$below/Shared/", $this->folderAt($holiday, 'Holiday')->getId(), $holiday->getStorage())])->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults());

		$this->assertFalse($plain?->approximate);
		$this->assertFalse($mounted?->approximate);
	}

	private function aclStorage(): IStorage {
		$storage = $this->createStub(IStorage::class);
		$storage->method('instanceOfStorage')->willReturnCallback(static fn (string $class): bool => $class === SubtreeExactness::ACL_STORAGE);
		return $storage;
	}

	// spec: LISTING-003.20
	public function testAFolderOnAStorageWithAdvancedPermissionsMayMissFiles(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg']);
		$photos = $this->folderAt($home, 'Photos');
		$folder = $this->createStub(Folder::class);
		$folder->method('getId')->willReturn($photos->getId());
		$folder->method('getPath')->willReturn($photos->getPath());
		$folder->method('getStorage')->willReturn($this->aclStorage());

		$this->assertTrue($this->counter()->count($folder, PairingExtensions::defaults())?->approximate);
	}

	// spec: LISTING-003.20
	public function testAMountedStorageWithAdvancedPermissionsOrAnUnknownSizeMayMissFiles(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg']);
		$other = $this->files(self::OTHER, ['Holiday/c.jpg', 'Other/d.jpg']);
		$below = '/' . self::USER . '/files/Photos';
		$holiday = $this->folderAt($other, 'Holiday');
		$unknown = $this->folderAt($other, 'Other');
		$update = $this->db->getQueryBuilder();
		$update->update('filecache')->set('size', $update->createNamedParameter(-1))->where($update->expr()->eq('fileid', $update->createNamedParameter($unknown->getId())))->executeStatement();

		$acl = $this->counter([$this->mount("$below/Team/", $holiday->getId(), $this->aclStorage())])->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults());
		$size = $this->counter([$this->mount("$below/Size/", $unknown->getId(), $other->getStorage())])->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults());

		$this->assertTrue($acl?->approximate);
		$this->assertTrue($size?->approximate);
	}

	// spec: LISTING-003.20
	public function testAHiddenMountDoesNotMakeTheCountApproximate(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg']);
		$mount = $this->mount('/' . self::USER . '/files/Photos/.hidden/Shared/', -1);

		$this->assertFalse($this->counter([$mount])->count($this->folderAt($home, 'Photos'), PairingExtensions::defaults())?->approximate);
	}

	// spec: LISTING-003.20
	public function testAFolderWithAnUnknownSizeMayMissFiles(): void {
		$home = $this->files(self::USER, ['Photos/a.jpg']);
		$photos = $this->folderAt($home, 'Photos');
		$update = $this->db->getQueryBuilder();
		$update->update('filecache')->set('size', $update->createNamedParameter(-1))->where($update->expr()->eq('fileid', $update->createNamedParameter($photos->getId())))->executeStatement();

		$this->assertTrue($this->counter()->count($photos, PairingExtensions::defaults())?->approximate);
	}

	// spec: LISTING-003.20
	public function testAFolderTheFileCacheDoesNotKnowHasNoCount(): void {
		$folder = $this->createStub(Folder::class);
		$folder->method('getId')->willReturn(PHP_INT_MAX);
		$folder->method('getPath')->willReturn('/' . self::USER . '/files/Gone');

		$this->assertNull($this->counter()->count($folder, PairingExtensions::defaults())?->pictures);
	}
}
