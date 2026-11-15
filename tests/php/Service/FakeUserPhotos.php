<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;

/** A `UserPhotos` over stubbed files that every user reaches alike. */
trait FakeUserPhotos {
	/** A file id every user reaches, but as a text file. */
	private const int TEXT_FILE = 50;

	/** The given file ids are photos, `TEXT_FILE` is a text file, every other id is out of reach. */
	private function userPhotos(int ...$photos): UserPhotos {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(fn (int $id): ?Node => match (true) {
			in_array($id, $photos, true) => $this->fakeFile("IMG_$id.JPG", 'image/jpeg'),
			$id === self::TEXT_FILE => $this->fakeFile('notes.txt', 'text/plain'),
			default => null,
		});
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		return new UserPhotos(new UserFolderResolver($root));
	}

	private function fakeFile(string $name, string $mime): File {
		$file = $this->createStub(File::class);
		$file->method('getName')->willReturn($name);
		$file->method('getMimetype')->willReturn($mime);
		return $file;
	}
}
