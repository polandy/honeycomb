<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\FolderService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class FolderServiceTest extends TestCase {
	use FakeFiles;

	private function service(IRootFolder $root): FolderService {
		return new FolderService(new UserFolderResolver($root));
	}

	/** A folder at `$path` whose listing holds `$children`. */
	private function folderWith(string $path, array $children = []): Folder {
		$folder = $this->folder($path);
		$folder->method('getDirectoryListing')->willReturn($children);
		return $folder;
	}

	public function testListsTheChildFoldersOfTheRoot(): void {
		$root = $this->folderWith('', [$this->folderWith('/Photos'), $this->folderWith('/Documents')]);

		$folders = $this->service($this->rootWith(['/' => $root]))->children($this->user(), '');

		$this->assertSame([
			['name' => 'Photos', 'path' => '/Photos', 'hasSubfolders' => false],
			['name' => 'Documents', 'path' => '/Documents', 'hasSubfolders' => false],
		], $folders);
	}

	public function testListsTheChildFoldersOfANestedFolder(): void {
		$trip = $this->folderWith('/Photos/2024/Trip');
		$year = $this->folderWith('/Photos/2024', [$trip]);

		$folders = $this->service($this->rootWith(['/Photos/2024' => $year]))->children($this->user(), '/Photos/2024');

		$this->assertSame([['name' => 'Trip', 'path' => '/Photos/2024/Trip', 'hasSubfolders' => false]], $folders);
	}

	public function testIncludesHiddenFoldersAndSkipsFiles(): void {
		$photos = $this->folderWith('/Photos', [
			$this->file(1, '/Photos/IMG_0001.JPG'),
			$this->folderWith('/Photos/.thumbnails'),
			$this->file(2, '/Photos/.hidden.jpg'),
		]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([['name' => '.thumbnails', 'path' => '/Photos/.thumbnails', 'hasSubfolders' => false]], $folders);
	}

	public function testHasSubfoldersOnlyWhenTheChildHoldsAFolder(): void {
		$withFolder = $this->folderWith('/Photos/2024', [$this->folderWith('/Photos/2024/Trip')]);
		$withFiles = $this->folderWith('/Photos/2023', [$this->file(1, '/Photos/2023/IMG_0001.JPG')]);
		$photos = $this->folderWith('/Photos', [$withFolder, $withFiles]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([true, false], array_column($folders, 'hasSubfolders'));
	}

	public function testAChildThatMayNotBeListedHasNoSubfolders(): void {
		$locked = $this->folder('/Photos/Locked');
		$locked->method('getDirectoryListing')->willThrowException(new NotPermittedException('Locked'));
		$photos = $this->folderWith('/Photos', [$locked]);

		$folders = $this->service($this->rootWith(['/Photos' => $photos]))->children($this->user(), 'Photos');

		$this->assertSame([['name' => 'Locked', 'path' => '/Photos/Locked', 'hasSubfolders' => false]], $folders);
	}

	/** @return array<string, array{string}> */
	public static function foreignPaths(): array {
		return [
			'parent of the user folder' => ['../bob/files/Photos'],
			'parent inside the path' => ['Photos/../../bob/files'],
			'null byte' => ["Photos\0"],
		];
	}

	#[DataProvider('foreignPaths')]
	public function testAForeignPathIsNotFound(string $path): void {
		$root = $this->createMock(IRootFolder::class);
		$root->expects($this->never())->method('getUserFolder');

		$this->expectException(FolderNotFoundException::class);
		$this->service($root)->children($this->user(), $path);
	}

	public function testAFolderOutsideTheUserFolderIsNotFound(): void {
		$foreign = $this->createStub(Folder::class);
		$foreign->method('getPath')->willReturn('/bob/files/Photos');
		$foreign->method('isReadable')->willReturn(true);

		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/Shared' => $foreign]))->children($this->user(), 'Shared');
	}

	public function testAVanishedFolderIsNotFound(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith([]))->children($this->user(), 'Gone');
	}

	public function testAFileIsNotAFolder(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/a.jpg' => $this->file(1, '/a.jpg')]))->children($this->user(), 'a.jpg');
	}

	public function testAnUnreadableFolderIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $this->folder('/Photos', false)]))->children($this->user(), 'Photos');
	}

	public function testAFolderThatMayNotBeOpenedIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => new NotPermittedException('Photos')]))->children($this->user(), 'Photos');
	}

	public function testAListingThatMayNotBeReadIsNotReadable(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $folder]))->children($this->user(), 'Photos');
	}
}
