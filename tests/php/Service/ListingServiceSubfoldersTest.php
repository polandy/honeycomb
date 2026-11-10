<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\EntryFactory;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotPermittedException;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\TestCase;

final class ListingServiceSubfoldersTest extends TestCase {
	use FakeFiles;

	private function service(IRootFolder $root, int $entryLimit = ListingService::ENTRY_LIMIT, int $pageSize = ListingService::PAGE_SIZE): ListingService {
		return new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class)), $entryLimit, $pageSize);
	}

	/** @param list<File> $files */
	private function photosWith(array $files, string $path = '/Photos'): Folder {
		$folder = $this->folder($path);
		$folder->method('search')->willReturnCallback($this->searchOver($files));
		return $folder;
	}

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

	public function testAHiddenFolderPickedOnPurposeIsListed(): void {
		$private = $this->photosWith([$this->file(1, '/.private/IMG_0001.JPG')], '/.private');

		$listing = $this->service($this->rootWith(['/.private' => $private]))->list($this->user(), '.private', true);

		$this->assertSame([1], array_column($this->entriesOf($listing), 'fileId'));
	}

	public function testPagesThroughTheFileCacheByFileId(): void {
		$files = array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), range(1, 5));

		$listing = $this->service($this->rootWith(['/Photos' => $this->photosWith($files)]), pageSize: 2)
			->list($this->user(), 'Photos', true);

		$this->assertSame(range(1, 5), array_column($this->entriesOf($listing), 'fileId'));
		$this->assertFalse($listing->jsonSerialize()['truncated']);
	}

	public function testStopsAtTheEntryLimitAcrossPages(): void {
		$files = array_map(fn (int $id): File => $this->file($id, "/Photos/IMG_$id.JPG"), range(1, 5));

		$listing = $this->service($this->rootWith(['/Photos' => $this->photosWith($files)]), 3, 2)
			->list($this->user(), 'Photos', true);

		$this->assertSame([1, 2, 3], array_column($this->entriesOf($listing), 'fileId'));
		$this->assertTrue($listing->jsonSerialize()['truncated']);
	}

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
		$service = new ListingService(new UserFolderResolver($this->rootWith(['/Photos' => $photos])), new EntryFactory($metadata));

		$listing = $service->list($this->user(), 'Photos', true);

		$this->assertCount(6300, $listing->jsonSerialize()['entries']);
	}

	public function testASearchThatMayNotBeRunIsNotReadable(): void {
		$photos = $this->folder('/Photos');
		$photos->method('search')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $photos]))->list($this->user(), 'Photos', true);
	}
}
