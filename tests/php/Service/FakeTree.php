<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;

/** An in-memory tree of alice's files under `/alice/files` that `OCP\Files` stubs read and change. */
trait FakeTree {
	private const string TREE_ROOT = '/alice/files';

	/** @var array<int, string> file id → path below the user's files, with a leading `/` */
	private array $files = [];
	/** @var array<string, int> folder path → folder id; `/` is the user's folder */
	private array $folders = ['/' => 1000];
	/** @var array<int, true> */
	private array $undeletable = [];
	/** @var array<string, true> folder paths the user may not create in */
	private array $readOnly = [];
	/** @var array<string, true> folder paths the user may not read */
	private array $unreadable = [];
	/** @var array<int, \Throwable> file id → what its next move throws */
	private array $moveFailures = [];
	/** @var array<int, int> file id → the id it gets when it moves, as across storages */
	private array $newIds = [];
	/** @var list<int> file ids in the order they went to the trash bin */
	private array $trashed = [];
	/** @var list<string> in the order they happened: `move <id> <path>` and `mkdir <path>` */
	private array $log = [];

	private function treeUser(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	private function treeRoot(): IRootFolder {
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $this->treeFolder('/')]]);
		return $root;
	}

	/** Adds files by id and path, and their folders. */
	private function addFiles(array $files): void {
		foreach ($files as $id => $path) {
			$this->files[$id] = $path;
			$this->addFolder(dirname($path));
		}
	}

	private function addFolder(string $path): void {
		for ($folder = $path; !isset($this->folders[$folder]); $folder = dirname($folder)) {
			$this->folders[$folder] = 2000 + count($this->folders);
		}
	}

	private function treeNode(string $path): ?Node {
		$path = '/' . trim($path, '/');
		if (isset($this->folders[$path])) {
			return $this->treeFolder($path);
		}
		$id = array_search($path, $this->files, true);
		return $id === false ? null : $this->treeFile($id);
	}

	private function treeFolder(string $path): Folder {
		$folder = $this->createStub(Folder::class);
		$folder->method('getId')->willReturn($this->folders[$path]);
		$folder->method('getName')->willReturn(basename($path));
		$folder->method('getPath')->willReturn(rtrim(self::TREE_ROOT . $path, '/'));
		$folder->method('getEtag')->willReturn('etag-folder' . $path);
		$folder->method('isCreatable')->willReturnCallback(fn (): bool => !isset($this->readOnly[$path]));
		$folder->method('isReadable')->willReturnCallback(fn (): bool => !isset($this->unreadable[$path]));
		$folder->method('getFirstNodeById')->willReturnCallback(fn (int $id): ?Node => isset($this->files[$id]) ? $this->treeFile($id) : null);
		$folder->method('get')->willReturnCallback(function (string $relative) use ($path): Node {
			$full = rtrim($path, '/') . '/' . trim($relative, '/');
			foreach (array_keys($this->unreadable) as $hidden) {
				if (str_starts_with($full, $hidden . '/')) {
					throw new NotPermittedException();
				}
			}
			return $this->treeNode($full) ?? throw new NotFoundException($full);
		});
		$folder->method('getDirectoryListing')->willReturnCallback(fn (): array => array_values(array_filter(
			array_map($this->treeNode(...), [...array_keys($this->folders), ...array_values($this->files)]),
			static fn (?Node $node): bool => $node !== null && $node->getPath() !== rtrim(self::TREE_ROOT . $path, '/') && dirname($node->getPath()) === rtrim(self::TREE_ROOT . $path, '/'),
		)));
		$folder->method('newFolder')->willReturnCallback(function (string $name) use ($path): Folder {
			$new = rtrim($path, '/') . '/' . $name;
			$this->folders[$new] = 2000 + count($this->folders);
			$this->log[] = "mkdir $new";
			return $this->treeFolder($new);
		});
		return $folder;
	}

	private function treeFile(int $id): File {
		$path = $this->files[$id];
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturn(basename($path));
		$file->method('getPath')->willReturn(self::TREE_ROOT . $path);
		$file->method('getEtag')->willReturn("etag-$id");
		$file->method('getMimetype')->willReturn(match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
			'jpg' => 'image/jpeg',
			'raf' => 'image/x-fuji-raf',
			'txt' => 'text/plain',
			default => 'application/octet-stream',
		});
		$file->method('isDeletable')->willReturn(!isset($this->undeletable[$id]));
		$file->method('delete')->willReturnCallback(function () use ($id): void {
			unset($this->files[$id]);
			$this->trashed[] = $id;
		});
		$file->method('move')->willReturnCallback(function (string $target) use ($id): Node {
			if (isset($this->moveFailures[$id])) {
				$failure = $this->moveFailures[$id];
				unset($this->moveFailures[$id]);
				throw $failure;
			}
			$path = substr($target, strlen(self::TREE_ROOT));
			if (!isset($this->folders[dirname($path)]) || $this->treeNode($path) !== null) {
				throw new NotPermittedException("cannot move $id to $path");
			}
			unset($this->files[$id]);
			$newId = $this->newIds[$id] ?? $id;
			unset($this->newIds[$id]);
			$this->files[$newId] = $path;
			$this->log[] = "move $id $path";
			return $this->treeFile($newId);
		});
		return $file;
	}
}
