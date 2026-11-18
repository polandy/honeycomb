<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\EntryFactory;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\SharedFolders;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCP\Constants;
use OCP\Files\Config\IUserMountCache;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotPermittedException;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\Share\IManager as IShareManager;
use OCP\Share\IShare;
use PHPUnit\Framework\TestCase;

final class ListingServiceSubfoldersTest extends TestCase {
	use FakeFiles;

	/** @var array<string, array> access lists by folder path below the user's files */
	private array $accessLists = [];
	/** @var array<int, true> the file ids that carry a share */
	private array $sharedIds = [];
	/** @var list<string> the folders whose access list was asked for */
	private array $lookups = [];
	/** @var int how often the user's shares were read, once per share type */
	private int $shareReads = 0;

	private function shares(): IShareManager {
		$shares = $this->createStub(IShareManager::class);
		$shares->method('getAccessList')->willReturnCallback(function (Node $folder): array {
			$path = substr($folder->getPath(), strlen(self::USER_ROOT));
			$this->lookups[] = $path;
			return $this->accessLists[$path] ?? [];
		});
		$shares->method('getSharesBy')->willReturnCallback(function (string $uid, int $type): array {
			$this->shareReads++;
			return $type === IShare::TYPE_USER ? array_map(function (int $fileId): IShare {
				$share = $this->createStub(IShare::class);
				$share->method('getNodeId')->willReturn($fileId);
				return $share;
			}, array_keys($this->sharedIds)) : [];
		});
		return $shares;
	}

	private function service(IRootFolder $root, int $entryLimit = ListingService::ENTRY_LIMIT): ListingService {
		$mounts = $this->createStub(IUserMountCache::class);
		$mounts->method('getMountsForStorageId')->willReturn([]);
		return new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class), new FakeVisualHashStore()), new SharedFolders($this->shares(), $mounts), $this->fileVersions(), $entryLimit);
	}

	// spec: LISTING-001.4
	public function testListsThePhotosAndSidecarsOfEveryFolderBelow(): void {
		$photos = $this->treeOf([
			$this->file(4, '/Photos/2024/IMG_0001.XMP', 'application/octet-stream'),
			$this->file(1, '/Photos/IMG_0001.JPG'),
			$this->file(2, '/Photos/2024/IMG_0001.CR2', 'image/x-dcraw'),
			$this->file(3, '/Photos/2024/notes.txt', 'text/plain'),
			$this->file(5, '/Photos/2024/Trip/IMG_0002.JPG'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);

		$this->assertSame(
			['/Photos/IMG_0001.JPG', '/Photos/2024/IMG_0001.CR2', '/Photos/2024/IMG_0001.XMP', '/Photos/2024/Trip/IMG_0002.JPG'],
			array_column($this->entriesOf($listing), 'path'),
		);
	}

	// spec: LISTING-001.13
	public function testListsTheRawFilesNextcloudDoesNotTypeBelowByName(): void {
		$photos = $this->treeOf([
			$this->file(1, '/Photos/2024/IMG_0001.CR3', 'application/octet-stream'),
			$this->file(2, '/Photos/2024/SAM_0002.SRW', 'application/octet-stream'),
			$this->file(3, '/Photos/2024/backup.bin', 'application/octet-stream'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);

		$this->assertSame([1, 2], array_column($this->entriesOf($listing), 'fileId'));
	}

	// spec: LISTING-001.5
	public function testSkipsHiddenFoldersAndFilesBelowThePickedFolder(): void {
		$photos = $this->treeOf([
			$this->file(1, '/Photos/.thumbnails/IMG_0001.JPG'),
			$this->file(2, '/Photos/2024/.git/IMG_0002.JPG'),
			$this->file(3, '/Photos/2024/._IMG_0003.JPG'),
			$this->file(4, '/Photos/2024/IMG_0004.JPG'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);

		$this->assertSame([4], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertSame(['/Photos', '/Photos/2024'], $this->listed);
	}

	// spec: LISTING-001.5
	public function testAHiddenFolderPickedOnPurposeIsListed(): void {
		$private = $this->treeOf([$this->file(1, '/.private/IMG_0001.JPG')], '/.private');

		$listing = $this->service($this->rootWith(['/.private' => $private]))->list($this->user(), '.private', true);

		$this->assertSame([1], array_column($this->entriesOf($listing), 'fileId'));
	}

	// spec: LISTING-001.4
	public function testReadsEachFolderOnceAndListsEachFileOnceAcrossFolderBoundaries(): void {
		$paths = ['/Photos/A/IMG_1.JPG', '/Photos/A/IMG_2.JPG', '/Photos/A/x/IMG_3.JPG', '/Photos/A/x/y/IMG_4.JPG', '/Photos/B/IMG_5.JPG', '/Photos/IMG_6.JPG', '/Photos/C/IMG_7.JPG'];
		$files = array_map(fn (int $id): File => $this->file($id, $paths[$id - 1]), range(1, count($paths)));

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files)]))->list($this->user(), 'Photos', true);

		$this->assertSame([6, 1, 2, 3, 4, 5, 7], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertSame(['/Photos', '/Photos/A', '/Photos/A/x', '/Photos/A/x/y', '/Photos/B', '/Photos/C'], $this->listed);
		$this->assertFalse($listing->jsonSerialize()['truncated']);
	}

	// spec: LISTING-001.16
	public function testLeavesOutTheExcludedFoldersWithoutOpeningThem(): void {
		$paths = ['/Photos/IMG_1.JPG', '/Photos/Raw/IMG_2.JPG', '/Photos/Raw/Best/IMG_3.JPG', '/Photos/Raws/IMG_4.JPG', '/Photos/A/Old/IMG_5.JPG', '/Photos/A/IMG_6.JPG'];
		$files = array_map(fn (int $id): File => $this->file($id, $paths[$id - 1]), range(1, count($paths)));

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files)]))->list($this->user(), 'Photos', true, ['/Photos/Raw', '/Photos/A/Old', '/Other']);

		$this->assertSame([1, 6, 4], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertSame(['/Photos', '/Photos/A', '/Photos/Raws'], $this->listed);
	}

	// spec: LISTING-001.4
	public function testLeavesOutAFolderBelowTheUserMayNotRead(): void {
		$files = [$this->file(1, '/Photos/Locked/IMG_1.JPG'), $this->file(2, '/Photos/Open/IMG_2.JPG')];

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files, unreadable: ['/Photos/Locked'])]))->list($this->user(), 'Photos', true);

		$this->assertSame([2], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertSame(['/Photos', '/Photos/Open'], $this->listed);
	}

	// spec: LISTING-001.6
	public function testStopsWalkingAtTheEntryLimit(): void {
		$files = [$this->file(1, '/Photos/A/IMG_1.JPG'), $this->file(2, '/Photos/A/IMG_2.JPG'), $this->file(3, '/Photos/B/IMG_3.JPG'), $this->file(4, '/Photos/B/IMG_4.JPG'), $this->file(5, '/Photos/C/IMG_5.JPG')];

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files)]), 3)->list($this->user(), 'Photos', true);

		$this->assertSame([1, 2, 3], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertTrue($listing->jsonSerialize()['truncated']);
		$this->assertSame(['/Photos', '/Photos/A', '/Photos/B'], $this->listed);
	}

	// spec: LISTING-001.10
	public function testListsTwoThousandPairsInFewQueries(): void {
		$files = [];
		foreach (range(1, 2100) as $n) {
			$files[] = $this->file(3 * $n, "/Photos/IMG_$n.CR2", 'image/x-dcraw');
			$files[] = $this->file(3 * $n + 1, "/Photos/IMG_$n.JPG");
			$files[] = $this->file(3 * $n + 2, "/Photos/IMG_$n.xmp", 'application/octet-stream');
		}
		$photos = $this->treeOf($files);
		$metadata = $this->createMock(IFilesMetadataManager::class);
		$metadata->expects($this->exactly(7))->method('getMetadataForFiles')->willReturnCallback(
			function (array $ids): array {
				$this->assertLessThanOrEqual(ListingService::METADATA_BATCH, count($ids));
				return [];
			},
		);
		$service = new ListingService(new UserFolderResolver($this->rootWith(['/Photos' => $photos])), new EntryFactory($metadata, new FakeVisualHashStore()), new SharedFolders($this->shares(), $this->createStub(IUserMountCache::class)), $this->fileVersions());

		$listing = $service->list($this->user(), 'Photos', true);

		$this->assertCount(6300, $listing->jsonSerialize()['entries']);
		$this->assertSame(['/Photos'], $this->listed);
	}

	// spec: LISTING-001.12
	public function testSaysOnceForEachFolderWhetherItIsShared(): void {
		$fed = $this->folder('/Photos/Fed', fileId: 3);
		$folders = ['/Photos' => $this->folder('/Photos'), '/Photos/Bob' => $this->folder('/Photos/Bob', fileId: 2)];
		$folders['/Photos/Fed/2024'] = $this->folder('/Photos/Fed/2024', fileId: 4, parent: fn (): Folder => $fed);
		$folders['/Photos/Team'] = $this->folder('/Photos/Team', mountType: 'group');
		$this->accessLists = ['/Photos/Bob' => ['users' => ['alice', 'bob']], '/Photos/Fed' => ['users' => ['alice'], 'remote' => true]];
		$this->sharedIds = [2 => true, 3 => true];
		$paths = [1 => '/Photos/IMG_1.JPG', 2 => '/Photos/Bob/IMG_2.JPG', 3 => '/Photos/IMG_3.JPG', 4 => '/Photos/Fed/2024/IMG_4.JPG', 5 => '/Photos/Team/IMG_5.JPG', 6 => '/Photos/Bob/IMG_6.JPG'];
		$files = [];
		foreach ($paths as $id => $path) {
			$files[] = $this->file($id, $path, parent: $folders[dirname($path)]);
		}

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files)]))->list($this->user(), 'Photos', true);

		$this->assertSame([
			['path' => '/Photos', 'shared' => false, 'permissions' => 31, 'versions' => true],
			['path' => '/Photos/Bob', 'shared' => true, 'permissions' => 31, 'versions' => true],
			['path' => '/Photos/Fed/2024', 'shared' => true, 'permissions' => 31, 'versions' => true],
			['path' => '/Photos/Team', 'shared' => true, 'permissions' => 31, 'versions' => true],
		], $listing->jsonSerialize()['folders']);
		$this->assertSame(['/Photos/Bob', '/Photos/Fed'], $this->lookups);
	}

	// spec: LISTING-001.17
	public function testReadsTheSharesOnceForAHundredFolders(): void {
		$files = array_map(fn (int $day): File => $this->file($day, "/Photos/d$day/IMG_$day.JPG"), range(1, 100));
		$this->sharedIds = [50 => true];

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files)]))->list($this->user(), 'Photos', true);

		$this->assertCount(100, $listing->jsonSerialize()['folders']);
		$this->assertLessThanOrEqual(15, $this->shareReads);
		$this->assertSame([], $this->lookups);
	}

	// spec: LISTING-001.14, LISTING-001.15
	public function testNamesEachFoldersPermissionsAndWhetherItKeepsVersions(): void {
		$folders = [
			'/Photos' => $this->folder('/Photos'),
			'/Photos/Lent' => $this->folder('/Photos/Lent', mountType: 'shared', permissions: Constants::PERMISSION_READ),
			'/Photos/Ext' => $this->folder('/Photos/Ext', mountType: 'external'),
		];
		$files = [];
		foreach ([1 => '/Photos/IMG_1.JPG', 2 => '/Photos/Lent/IMG_2.JPG', 3 => '/Photos/Ext/IMG_3.JPG'] as $id => $path) {
			$files[] = $this->file($id, $path, parent: $folders[dirname($path)]);
		}

		$listing = $this->service($this->rootWith(['/Photos' => $this->treeOf($files)]))->list($this->user(), 'Photos', true);

		$this->assertEqualsCanonicalizing([
			['/Photos', Constants::PERMISSION_ALL, true],
			['/Photos/Ext', Constants::PERMISSION_ALL, false],
			['/Photos/Lent', Constants::PERMISSION_READ, true],
		], array_map(static fn (array $folder): array => [$folder['path'], $folder['permissions'], $folder['versions']], $listing->jsonSerialize()['folders']));
	}

	// spec: LISTING-001.15
	public function testAFolderOnAStorageWithoutAVersionsBackendKeepsNone(): void {
		$root = $this->rootWith(['/Photos' => $this->treeOf([$this->file(1, '/Photos/IMG_1.JPG')])]);
		$service = new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class), new FakeVisualHashStore()), new SharedFolders($this->shares(), $this->createStub(IUserMountCache::class)), $this->fileVersions(false));

		$this->assertFalse($service->list($this->user(), 'Photos', false)->jsonSerialize()['folders'][0]['versions']);
	}

	// spec: LISTING-001.8
	public function testAListingThatMayNotBeReadIsNotReadable(): void {
		$photos = $this->folder('/Photos');
		$photos->method('getDirectoryListing')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);
	}
}
