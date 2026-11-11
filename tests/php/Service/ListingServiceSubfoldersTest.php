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
use OCP\Files\Config\IUserMountCache;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotPermittedException;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\Share\IManager as IShareManager;
use PHPUnit\Framework\TestCase;

final class ListingServiceSubfoldersTest extends TestCase {
	use FakeFiles;

	/** @var array<string, array> access lists by folder path below the user's files */
	private array $accessLists = [];
	/** @var list<string> the folders whose access list was asked for */
	private array $lookups = [];

	private function shares(): IShareManager {
		$shares = $this->createStub(IShareManager::class);
		$shares->method('getAccessList')->willReturnCallback(function (Node $folder): array {
			$path = substr($folder->getPath(), strlen(self::USER_ROOT));
			$this->lookups[] = $path;
			return $this->accessLists[$path] ?? [];
		});
		return $shares;
	}

	private function service(IRootFolder $root, int $entryLimit = ListingService::ENTRY_LIMIT, int $pageSize = ListingService::PAGE_SIZE): ListingService {
		return new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class)), new SharedFolders($this->shares(), $this->createStub(IUserMountCache::class)), $entryLimit, $pageSize);
	}

	/** @param list<File> $files */
	private function photosWith(array $files, string $path = '/Photos'): Folder {
		$folder = $this->folder($path);
		$folder->method('search')->willReturnCallback($this->searchOver($files));
		return $folder;
	}

	// spec: LISTING-001.4
	public function testListsEveryFolderBelowWithOneQueryByMimeTypeAndName(): void {
		$photos = $this->photosWith([
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
		$photos = $this->photosWith([
			$this->file(1, '/Photos/2024/IMG_0001.CR3', 'application/octet-stream'),
			$this->file(2, '/Photos/2024/SAM_0002.SRW', 'application/octet-stream'),
			$this->file(3, '/Photos/2024/backup.bin', 'application/octet-stream'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);

		$this->assertSame([1, 2], array_column($this->entriesOf($listing), 'fileId'));
	}

	// spec: LISTING-001.5
	public function testSkipsHiddenFoldersAndFilesBelowThePickedFolder(): void {
		$photos = $this->photosWith([
			$this->file(1, '/Photos/.thumbnails/IMG_0001.JPG'),
			$this->file(2, '/Photos/2024/.git/IMG_0002.JPG'),
			$this->file(3, '/Photos/2024/._IMG_0003.JPG'),
			$this->file(4, '/Photos/2024/IMG_0004.JPG'),
		]);

		$listing = $this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);

		$this->assertSame([4], array_column($this->entriesOf($listing), 'fileId'));
	}

	// spec: LISTING-001.5
	public function testAHiddenFolderPickedOnPurposeIsListed(): void {
		$private = $this->photosWith([$this->file(1, '/.private/IMG_0001.JPG')], '/.private');

		$listing = $this->service($this->rootWith(['/.private' => $private]))->list($this->user(), '.private', true);

		$this->assertSame([1], array_column($this->entriesOf($listing), 'fileId'));
	}

	// spec: LISTING-001.4
	public function testPagesThroughTheFileCacheByFileId(): void {
		$files = array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), range(1, 5));

		$listing = $this->service($this->rootWith(['/Photos' => $this->photosWith($files)]), pageSize: 2)
			->list($this->user(), 'Photos', true);

		$this->assertSame(range(1, 5), array_column($this->entriesOf($listing), 'fileId'));
		$this->assertFalse($listing->jsonSerialize()['truncated']);
	}

	// spec: LISTING-001.6
	public function testStopsAtTheEntryLimitAcrossPages(): void {
		$files = array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), range(1, 5));

		$listing = $this->service($this->rootWith(['/Photos' => $this->photosWith($files)]), 3, 2)
			->list($this->user(), 'Photos', true);

		$this->assertSame([1, 2, 3], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertTrue($listing->jsonSerialize()['truncated']);
	}

	// spec: LISTING-001.10
	public function testListsTwoThousandPairsInFewQueries(): void {
		$files = [];
		foreach (range(1, 2100) as $n) {
			$files[] = $this->file(3 * $n, "/Photos/IMG_$n.CR2", 'image/x-dcraw');
			$files[] = $this->file(3 * $n + 1, "/Photos/IMG_$n.JPG");
			$files[] = $this->file(3 * $n + 2, "/Photos/IMG_$n.xmp", 'application/octet-stream');
		}
		$photos = $this->folder('/Photos');
		$photos->method('search')->willReturnCallback($this->searchOver($files));
		$metadata = $this->createMock(IFilesMetadataManager::class);
		$metadata->expects($this->exactly(7))->method('getMetadataForFiles')->willReturnCallback(
			function (array $ids): array {
				$this->assertLessThanOrEqual(ListingService::METADATA_BATCH, count($ids));
				return [];
			},
		);
		$service = new ListingService(new UserFolderResolver($this->rootWith(['/Photos' => $photos])), new EntryFactory($metadata), new SharedFolders($this->shares(), $this->createStub(IUserMountCache::class)));

		$listing = $service->list($this->user(), 'Photos', true);

		$this->assertCount(6300, $listing->jsonSerialize()['entries']);
	}

	// spec: LISTING-001.12
	public function testSaysOnceForEachFolderWhetherItIsShared(): void {
		$folders = array_map($this->folder(...), ['/Photos' => '/Photos', '/Photos/Bob' => '/Photos/Bob', '/Photos/Fed/2024' => '/Photos/Fed/2024']);
		$folders['/Photos/Team'] = $this->folder('/Photos/Team', mountType: 'group');
		$this->accessLists = ['/Photos/Bob' => ['users' => ['alice', 'bob']], '/Photos/Fed/2024' => ['users' => ['alice'], 'remote' => true]];
		$paths = [1 => '/Photos/IMG_1.JPG', 2 => '/Photos/Bob/IMG_2.JPG', 3 => '/Photos/IMG_3.JPG', 4 => '/Photos/Fed/2024/IMG_4.JPG', 5 => '/Photos/Team/IMG_5.JPG', 6 => '/Photos/Bob/IMG_6.JPG'];
		$files = [];
		foreach ($paths as $id => $path) {
			$files[] = $this->file($id, $path, parent: $folders[dirname($path)]);
		}

		$listing = $this->service($this->rootWith(['/Photos' => $this->photosWith($files)]))->list($this->user(), 'Photos', true);

		$this->assertSame([
			['path' => '/Photos', 'shared' => false],
			['path' => '/Photos/Bob', 'shared' => true],
			['path' => '/Photos/Fed/2024', 'shared' => true],
			['path' => '/Photos/Team', 'shared' => true],
		], $listing->jsonSerialize()['folders']);
		$this->assertSame(['/Photos', '/Photos/Bob', '/Photos/Fed/2024'], $this->lookups);
	}

	// spec: LISTING-001.8
	public function testASearchThatMayNotBeRunIsNotReadable(): void {
		$photos = $this->folder('/Photos');
		$photos->method('search')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);
	}
}
