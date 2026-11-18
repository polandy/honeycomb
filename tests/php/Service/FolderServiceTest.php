<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\FolderService;
use OCA\Honeycomb\Service\PhotoFilesBelow;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCP\Files\FileInfo;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class FolderServiceTest extends TestCase {
	use FakeFiles;

	private function service(IRootFolder $root, PhotoFilesBelow $below = new FakePhotoFilesBelow(), ?LoggerInterface $logger = null): FolderService {
		return new FolderService(new UserFolderResolver($root), $below, $logger ?? $this->createStub(LoggerInterface::class));
	}

	/** A folder at `$path` whose listing holds `$children`, filtered to folders on request. */
	private function folderWith(string $path, array $children = []): Folder {
		$folder = $this->folder($path);
		$folder->method('getDirectoryListing')->willReturnCallback(
			static fn (?string $mime = null): array => $mime === FileInfo::MIMETYPE_FOLDER
				? array_values(array_filter($children, static fn (object $node): bool => $node instanceof Folder))
				: $children,
		);
		return $folder;
	}

	// spec: LISTING-003.1
	public function testListsTheChildFoldersOfTheRoot(): void {
		$root = $this->folderWith('', [$this->folderWith('/Photos'), $this->folderWith('/Documents')]);

		$folders = $this->service($this->rootWith(['/' => $root]))->children($this->user(), '');

		$this->assertSame([
			['name' => 'Photos', 'path' => '/Photos', 'hasSubfolders' => false, 'photoFiles' => 0, 'photoFilesBelow' => 0, 'photoFilesBelowApproximate' => false],
			['name' => 'Documents', 'path' => '/Documents', 'hasSubfolders' => false, 'photoFiles' => 0, 'photoFilesBelow' => 0, 'photoFilesBelowApproximate' => false],
		], $folders);
	}

	// spec: LISTING-003.1
	public function testListsTheChildFoldersOfANestedFolder(): void {
		$trip = $this->folderWith('/Photos/2024/Trip');
		$year = $this->folderWith('/Photos/2024', [$trip]);

		$folders = $this->service($this->rootWith(['/Photos/2024' => $year]))->children($this->user(), '/Photos/2024');

		$this->assertSame([['name' => 'Trip', 'path' => '/Photos/2024/Trip', 'hasSubfolders' => false, 'photoFiles' => 0, 'photoFilesBelow' => 0, 'photoFilesBelowApproximate' => false]], $folders);
	}

	// spec: LISTING-003.1
	public function testIncludesHiddenFoldersAndSkipsFiles(): void {
		$photos = $this->folderWith('/Photos', [
			$this->file(1, '/Photos/IMG_0001.JPG'),
			$this->folderWith('/Photos/.thumbnails'),
			$this->file(2, '/Photos/.hidden.jpg'),
		]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([['name' => '.thumbnails', 'path' => '/Photos/.thumbnails', 'hasSubfolders' => false, 'photoFiles' => null, 'photoFilesBelow' => null, 'photoFilesBelowApproximate' => false]], $folders);
	}

	// spec: LISTING-003.2
	public function testHasSubfoldersOnlyWhenTheChildHoldsAFolder(): void {
		$withFolder = $this->folderWith('/Photos/2024', [$this->folderWith('/Photos/2024/Trip')]);
		$withFiles = $this->folderWith('/Photos/2023', [$this->file(1, '/Photos/2023/IMG_0001.JPG')]);
		$photos = $this->folderWith('/Photos', [$withFolder, $withFiles]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([true, false], array_column($folders, 'hasSubfolders'));
	}

	// spec: LISTING-003.2
	public function testAChildThatMayNotBeListedHasNoSubfolders(): void {
		$locked = $this->folder('/Photos/Locked');
		$locked->method('getDirectoryListing')->willThrowException(new NotPermittedException('Locked'));
		$photos = $this->folderWith('/Photos', [$locked]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([['name' => 'Locked', 'path' => '/Photos/Locked', 'hasSubfolders' => false, 'photoFiles' => null, 'photoFilesBelow' => null, 'photoFilesBelowApproximate' => false]], $folders);
	}

	// spec: LISTING-003.19
	public function testCountsThePhotoFilesOfEachChildWithoutItsSubfolders(): void {
		$day = $this->folderWith('/Photos/Day', [
			$this->file(1, '/Photos/Day/IMG_1.JPG'),
			$this->file(2, '/Photos/Day/IMG_1.CR3', 'application/octet-stream'),
			$this->file(3, '/Photos/Day/IMG_1.xmp', 'application/octet-stream'),
			$this->file(4, '/Photos/Day/notes.txt', 'text/plain'),
			$this->file(5, '/Photos/Day/.IMG_2.JPG'),
			$this->folderWith('/Photos/Day/Edits', [$this->file(6, '/Photos/Day/Edits/IMG_3.JPG')]),
		]);
		$photos = $this->folderWith('/Photos', [$day, $this->folderWith('/Photos/Empty')]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([2, 0], array_column($folders, 'photoFiles'));
	}

	// spec: LISTING-003.19
	public function testAHiddenChildHasNoCount(): void {
		$hidden = $this->folderWith('/Photos/.cache', [$this->file(1, '/Photos/.cache/IMG_1.JPG')]);
		$photos = $this->folderWith('/Photos', [$hidden]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([null], array_column($folders, 'photoFiles'));
	}

	// spec: LISTING-003.20
	public function testCountsThePhotoFilesBelowEachChildFromTheFileIndex(): void {
		$photos = $this->folderWith('/Photos', [$this->folderWith('/Photos/2024'), $this->folderWith('/Photos/Empty')]);
		$below = new FakePhotoFilesBelow([self::USER_ROOT . '/Photos/2024' => 1200]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]), $below)->children($this->user(), 'Photos');

		$this->assertSame([1200, 0], array_column($folders, 'photoFilesBelow'));
	}

	// spec: LISTING-003.20
	public function testFlagsACountBelowThatMayMissFiles(): void {
		$photos = $this->folderWith('/Photos', [$this->folderWith('/Photos/Team'), $this->folderWith('/Photos/Own')]);
		$below = new FakePhotoFilesBelow([self::USER_ROOT . '/Photos/Team' => 40], approximate: [self::USER_ROOT . '/Photos/Team']);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]), $below)->children($this->user(), 'Photos');

		$this->assertSame([true, false], array_column($folders, 'photoFilesBelowApproximate'));
	}

	// spec: LISTING-003.20
	public function testAHiddenOrUnlistableChildHasNoCountBelow(): void {
		$locked = $this->folder('/Photos/Locked');
		$locked->method('getDirectoryListing')->willThrowException(new NotPermittedException('Locked'));
		$photos = $this->folderWith('/Photos', [$this->folderWith('/Photos/.cache'), $locked]);
		$below = new FakePhotoFilesBelow([self::USER_ROOT . '/Photos/.cache' => 5, self::USER_ROOT . '/Photos/Locked' => 7]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]), $below)->children($this->user(), 'Photos');

		$this->assertSame([null, null], array_column($folders, 'photoFilesBelow'));
	}

	// spec: LISTING-003.20
	public function testAChildTheFileIndexDoesNotKnowHasNoCountBelow(): void {
		$photos = $this->folderWith('/Photos', [$this->folderWith('/Photos/New')]);
		$below = new FakePhotoFilesBelow([self::USER_ROOT . '/Photos/New' => null]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]), $below)->children($this->user(), 'Photos');

		$this->assertSame([null], array_column($folders, 'photoFilesBelow'));
	}

	// spec: LISTING-003.20
	public function testAFailingFileIndexLeavesTheCountBelowOutAndIsLogged(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning');
		$photos = $this->folderWith('/Photos', [$this->folderWith('/Photos/2024', [$this->file(1, '/Photos/2024/IMG_1.JPG')])]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]), new FakePhotoFilesBelow(fails: true), $logger)->children($this->user(), 'Photos');

		$this->assertSame([['name' => '2024', 'path' => '/Photos/2024', 'hasSubfolders' => false, 'photoFiles' => 1, 'photoFilesBelow' => null, 'photoFilesBelowApproximate' => false]], $folders);
	}

	// spec: LISTING-003.2, LISTING-003.19
	public function testListsEachChildOnce(): void {
		$filters = [];
		$year = $this->folder('/Photos/2024');
		$year->method('getDirectoryListing')->willReturnCallback(function (?string $mime = null) use (&$filters): array {
			$filters[] = $mime;
			return [$this->folderWith('/Photos/2024/Trip')];
		});
		$photos = $this->folderWith('/Photos', [$year]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([true], array_column($folders, 'hasSubfolders'));
		$this->assertSame([null], $filters);
	}

	// spec: LISTING-003.2
	public function testAChildThatVanishedHasNoSubfolders(): void {
		$gone = $this->folder('/Photos/Gone');
		$gone->method('getDirectoryListing')->willThrowException(new NotFoundException('Gone'));
		$photos = $this->folderWith('/Photos', [$gone]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([['name' => 'Gone', 'path' => '/Photos/Gone', 'hasSubfolders' => false, 'photoFiles' => null, 'photoFilesBelow' => null, 'photoFilesBelowApproximate' => false]], $folders);
	}

	/** @return array<string, array{string}> */
	public static function foreignPaths(): array {
		return [
			'parent of the user folder' => ['../bob/files/Photos'],
			'parent inside the path' => ['Photos/../../bob/files'],
			'null byte' => ["Photos\0"],
		];
	}

	// spec: LISTING-003.3
	#[DataProvider('foreignPaths')]
	public function testAForeignPathIsNotFound(string $path): void {
		$root = $this->createMock(IRootFolder::class);
		$root->expects($this->never())->method('getUserFolder');

		$this->expectException(FolderNotFoundException::class);
		$this->service($root)->children($this->user(), $path);
	}

	// spec: LISTING-003.3
	public function testAFolderOutsideTheUserFolderIsNotFound(): void {
		$foreign = $this->createStub(Folder::class);
		$foreign->method('getPath')->willReturn('/bob/files/Photos');
		$foreign->method('isReadable')->willReturn(true);

		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/Shared' => $foreign]))->children($this->user(), 'Shared');
	}

	// spec: LISTING-003.3
	public function testAVanishedFolderIsNotFound(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith([]))->children($this->user(), 'Gone');
	}

	// spec: LISTING-003.3
	public function testAFileIsNotAFolder(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/a.jpg' => $this->file(1, '/a.jpg')]))->children($this->user(), 'a.jpg');
	}

	// spec: LISTING-003.3
	public function testAnUnreadableFolderIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $this->folder('/Photos', false)]))->children($this->user(), 'Photos');
	}

	// spec: LISTING-003.3
	public function testAFolderThatMayNotBeOpenedIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => new NotPermittedException('Photos')]))->children($this->user(), 'Photos');
	}

	// spec: LISTING-003.3
	public function testAListingThatMayNotBeReadIsNotReadable(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $folder]))->children($this->user(), 'Photos');
	}
}
