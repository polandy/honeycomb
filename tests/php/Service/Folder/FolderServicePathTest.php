<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Folder;

use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Service\Files\FolderNotFoundException;
use OCA\Honeycomb\Service\Files\FolderNotReadableException;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Folder\FolderService;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakePicturesBelow;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/** The folder a request names must be the user's own and readable (LISTING-003.3). */
final class FolderServicePathTest extends TestCase {
	use FakeFiles;

	private function service(IRootFolder $root): FolderService {
		return new FolderService(new UserFolderResolver($root), new FakePicturesBelow(), $this->createStub(LoggerInterface::class));
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
		$this->service($root)->children($this->user(), $path, PairingExtensions::defaults());
	}

	// spec: LISTING-003.3
	public function testAFolderOutsideTheUserFolderIsNotFound(): void {
		$foreign = $this->createStub(Folder::class);
		$foreign->method('getPath')->willReturn('/bob/files/Photos');
		$foreign->method('isReadable')->willReturn(true);

		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/Shared' => $foreign]))->children($this->user(), 'Shared', PairingExtensions::defaults());
	}

	// spec: LISTING-003.3
	public function testAVanishedFolderIsNotFound(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith([]))->children($this->user(), 'Gone', PairingExtensions::defaults());
	}

	// spec: LISTING-003.3
	public function testAFileIsNotAFolder(): void {
		$this->expectException(FolderNotFoundException::class);
		$this->service($this->rootWith(['/a.jpg' => $this->file(1, '/a.jpg')]))->children($this->user(), 'a.jpg', PairingExtensions::defaults());
	}

	// spec: LISTING-003.3
	public function testAnUnreadableFolderIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $this->folder('/Photos', false)]))->children($this->user(), 'Photos', PairingExtensions::defaults());
	}

	// spec: LISTING-003.3
	public function testAFolderThatMayNotBeOpenedIsNotReadable(): void {
		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => new NotPermittedException('Photos')]))->children($this->user(), 'Photos', PairingExtensions::defaults());
	}

	// spec: LISTING-003.3
	public function testAListingThatMayNotBeReadIsNotReadable(): void {
		$folder = $this->folder('/Photos');
		$folder->method('getDirectoryListing')->willThrowException(new NotPermittedException('Photos'));

		$this->expectException(FolderNotReadableException::class);
		$this->service($this->rootWith(['/Photos' => $folder]))->children($this->user(), 'Photos', PairingExtensions::defaults());
	}
}
