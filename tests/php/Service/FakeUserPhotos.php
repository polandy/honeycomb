<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\Constants;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;

/** A `UserPhotos` over stubbed files that every user reaches alike. */
trait FakeUserPhotos {
	use FakeFileIdSearch;

	/** A file id every user reaches, but as a text file. */
	private const int TEXT_FILE = 50;

	/** The given file ids are photos, `TEXT_FILE` is a text file, every other id is out of reach. */
	private function userPhotos(int ...$photos): UserPhotos {
		return $this->userPhotosWith(array_fill_keys($photos, Constants::PERMISSION_ALL));
	}

	/** @param array<int, int> $photos the permissions of each photo's folder, by file id */
	private function userPhotosWith(array $photos): UserPhotos {
		$byId = fn (int $id): ?Node => match (true) {
			isset($photos[$id]) => $this->fakeFile($id, "IMG_$id.JPG", 'image/jpeg', $photos[$id]),
			$id === self::TEXT_FILE => $this->fakeFile($id, 'notes.txt', 'text/plain'),
			default => null,
		};
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback($byId);
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($byId));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		return new UserPhotos(new UserFolderResolver($root));
	}

	private function fakeFile(int $id, string $name, string $mime, int $permissions = Constants::PERMISSION_ALL): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturn($name);
		$file->method('getMimetype')->willReturn($mime);
		$file->method('getPath')->willReturn("/alice/files/Photos/$name");
		$folder = $this->createStub(Folder::class);
		$folder->method('getPermissions')->willReturn($permissions);
		$file->method('getParent')->willReturn($folder);
		return $file;
	}
}
