<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SidecarWriter;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\Files\File;
use OCP\Files\FileInfo;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\IUser;
use Psr\Log\LoggerInterface;

/** A folder of sidecars on a fake disk, and the `SidecarWriter` that writes into it. */
trait FakeSidecarFolder {
	use StatsFixture;

	private const string FOLDER = '/alice/files/Photos';
	private const int NEW_ID = 99;

	/** @var array<string, string> bytes by name in the folder */
	private array $disk = ['IMG_0001.NEF' => 'raw', 'IMG_0001.NEF.xmp' => 'old', 'IMG_0002.JPG' => 'jpeg'];
	/** @var list<string> */
	private array $events = [];
	/** @var array<string, \Throwable> failures by step: `newFile`, `putContent` */
	private array $failures = [];
	private bool $creatable = true;
	private bool $updateable = true;
	/** The bytes the folder's storage has left, or a negative `FileInfo::SPACE_*` when unknown. */
	private int|float $freeSpace = FileInfo::SPACE_UNKNOWN;
	/** @var array<string, int> modification times by name; others count up from November 2023 with each event */
	private array $mtimes = [];
	/** The modification time a write gives its file, or null to leave it to the count. */
	private ?int $writtenAt = null;

	private function user(string $uid = 'alice'): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	/** A file of the folder as `OCP\Files` gives it now: its ETag follows its bytes. */
	private function node(string $name, Folder $folder): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($name === 'IMG_0001.NEF.xmp' ? 9 : self::NEW_ID);
		$file->method('getName')->willReturn($name);
		$file->method('getPath')->willReturn(self::FOLDER . "/$name");
		$file->method('getMimetype')->willReturn(str_ends_with($name, '.xmp') ? 'application/octet-stream' : 'image/jpeg');
		$file->method('getEtag')->willReturnCallback(fn (): string => md5($this->disk[$name]));
		$file->method('getSize')->willReturnCallback(fn (): int => strlen($this->disk[$name]));
		$file->method('getMTime')->willReturnCallback(fn (): int => $this->mtimes[$name] ?? 1_700_000_000 + count($this->events));
		$file->method('putContent')->willReturnCallback(function (string $content) use ($name): void {
			$this->failOn('putContent');
			$this->disk[$name] = $content;
			$this->written($name);
			$this->events[] = "put $name";
		});
		$file->method('isUpdateable')->willReturn($this->updateable);
		$file->method('getParent')->willReturn($folder);
		return $file;
	}

	private function written(string $name): void {
		if ($this->writtenAt !== null) {
			$this->mtimes[$name] = $this->writtenAt;
		}
	}

	private function failOn(string $step): void {
		if (isset($this->failures[$step])) {
			throw $this->failures[$step];
		}
	}

	/** @param string $nodeNamed the name file id 9 resolves to */
	private function writer(?LoggerInterface $logger = null, string $nodeNamed = 'IMG_0001.NEF.xmp'): SidecarWriter {
		$folder = $this->createStub(Folder::class);
		$folder->method('getPath')->willReturn(self::FOLDER);
		$folder->method('isCreatable')->willReturnCallback(fn (): bool => $this->creatable);
		$folder->method('getFreeSpace')->willReturnCallback(fn (): int|float => $this->freeSpace);
		$folder->method('nodeExists')->willReturnCallback(fn (string $name): bool => isset($this->disk[$name]));
		$folder->method('newFile')->willReturnCallback(function (string $name, string $content) use ($folder): File {
			$this->failOn('newFile');
			$this->disk[$name] = $content;
			$this->written($name);
			$this->events[] = "write $name";
			return $this->node($name, $folder);
		});
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(function (int $id) use ($folder, $nodeNamed): ?Node {
			if ($id !== 9 || !isset($this->disk['IMG_0001.NEF.xmp'])) {
				return null;
			}
			$this->disk[$nodeNamed] ??= $this->disk['IMG_0001.NEF.xmp'];
			return $this->node($nodeNamed, $folder);
		});
		$userFolder->method('get')->willReturnCallback(function (string $path) use ($folder): Node {
			$name = substr($path, strlen('/Photos/'));
			if (dirname($path) !== '/Photos' || !isset($this->disk[$name])) {
				throw new NotFoundException($path);
			}
			return $this->node($name, $folder);
		});
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new SidecarWriter(new UserPhotos(new UserFolderResolver($root)), $logger ?? $this->createStub(LoggerInterface::class), $this->stats());
	}

	private function existing(string $content, ?string $etag = null, ?int $size = null): array {
		return ['fileId' => 9, 'etag' => $etag ?? md5('old'), 'size' => $size ?? 3, 'content' => base64_encode($content)];
	}

	private function created(string $content, string $path = '/Photos/IMG_0002.JPG.xmp'): array {
		return ['path' => $path, 'content' => base64_encode($content)];
	}

	/** @param list<array<string, mixed>> $results */
	private function resultsOf(array $results): array {
		return array_column($results, 'result');
	}
}
