<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\Listing;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Mount\IMountPoint;
use OCP\Files\Node;
use OCP\FilesMetadata\Exceptions\FilesMetadataNotFoundException;
use OCP\FilesMetadata\Model\IFilesMetadata;
use OCP\IUser;
use PHPUnit\Framework\MockObject\Stub;

/** Stubs of `OCP\Files` for the user `alice`, whose files live under `/alice/files`. */
trait FakeFiles {
	private const string USER_ROOT = '/alice/files';

	/** @var list<string> the folders whose listing was read, by path below the user's files */
	private array $listed = [];

	/** @return list<array<string, mixed>> */
	private function entriesOf(Listing $listing): array {
		return json_decode(json_encode($listing->jsonSerialize()['entries'], JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	private function file(int $id, string $path, string $mime = 'image/jpeg', ?Folder $parent = null): File&Stub {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getPath')->willReturn(self::USER_ROOT . $path);
		$file->method('getName')->willReturn(basename($path));
		$file->method('getSize')->willReturn(1000 + $id);
		$file->method('getMTime')->willReturn(1_700_000_000 + $id);
		$file->method('getEtag')->willReturn("etag-$id");
		$file->method('getMimetype')->willReturn($mime);
		$file->method('getParent')->willReturnCallback(fn (): Folder => $parent ?? $this->folder(dirname($path)));
		return $file;
	}

	/** A folder at `$path` below the user's files. */
	private function folder(string $path, bool $readable = true, string $mountType = ''): Folder&Stub {
		$mount = $this->createStub(IMountPoint::class);
		$mount->method('getMountType')->willReturn($mountType);
		$folder = $this->createStub(Folder::class);
		$folder->method('getMountPoint')->willReturn($mount);
		$absolute = rtrim(self::USER_ROOT . $path, '/');
		$folder->method('getPath')->willReturn($absolute);
		$folder->method('getName')->willReturn(basename($absolute));
		$folder->method('isReadable')->willReturn($readable);
		$folder->method('getRelativePath')->willReturnCallback(
			static fn (string $node): ?string => match (true) {
				$node === $absolute => '/',
				str_starts_with($node, $absolute . '/') => substr($node, strlen($absolute)),
				default => null,
			},
		);
		return $folder;
	}

	/**
	 * A root folder whose user folder resolves `$nodes` by their path below the user's files.
	 * @param array<string, \OCP\Files\Node|\Throwable> $nodes
	 */
	private function rootWith(array $nodes): IRootFolder {
		$userFolder = $this->folder('');
		$userFolder->method('get')->willReturnCallback(
			static function (string $path) use ($nodes): \OCP\Files\Node {
				$key = '/' . trim($path, '/');
				if (!isset($nodes[$key])) {
					throw new \OCP\Files\NotFoundException($path);
				}
				if ($nodes[$key] instanceof \Throwable) {
					throw $nodes[$key];
				}
				return $nodes[$key];
			},
		);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return $root;
	}

	/** Metadata as Nextcloud's Photos app stores it, missing keys throw like the real one. */
	private function metadata(array $values): IFilesMetadata {
		$metadata = $this->createStub(IFilesMetadata::class);
		$lookup = static function (string $key) use ($values): mixed {
			if (!array_key_exists($key, $values)) {
				throw new FilesMetadataNotFoundException($key);
			}
			return $values[$key];
		};
		$metadata->method('hasKey')->willReturnCallback(static fn (string $key): bool => array_key_exists($key, $values));
		$metadata->method('getInt')->willReturnCallback($lookup);
		$metadata->method('getArray')->willReturnCallback($lookup);
		return $metadata;
	}

	/**
	 * The folder at `$path` with `$files` in folders below it, each listed in name order like the
	 * file cache; every listing read is recorded in `$listed`.
	 * @param list<File> $files
	 * @param list<string> $unreadable folders the user may not read
	 */
	private function treeOf(array $files, string $path = '/Photos', array $unreadable = []): Folder {
		$children = [$path => []];
		foreach ($files as $file) {
			for ($dir = dirname($this->below($file)); !isset($children[$dir]); $dir = dirname($dir)) {
				$children[$dir] = [];
			}
		}
		$folders = [];
		foreach (array_keys($children) as $dir) {
			$folders[$dir] = $this->folder($dir, !in_array($dir, $unreadable, true));
		}
		foreach ($files as $file) {
			$children[dirname($this->below($file))][] = $file;
		}
		foreach ($folders as $dir => $folder) {
			if ($dir !== $path) {
				$children[dirname($dir)][] = $folder;
			}
		}
		foreach ($folders as $dir => $folder) {
			$listing = $children[$dir];
			usort($listing, static fn (Node $a, Node $b): int => strcmp($a->getName(), $b->getName()));
			$folder->method('getDirectoryListing')->willReturnCallback(function () use ($dir, $listing): array {
				$this->listed[] = $dir;
				return $listing;
			});
		}
		return $folders[$path];
	}

	private function below(Node $node): string {
		return substr($node->getPath(), strlen(self::USER_ROOT));
	}
}
