<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileVersions;
use OCA\Honeycomb\Service\SidecarResult;
use OCA\Honeycomb\Service\SidecarWriter;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Service\VersionBackends;
use OCP\App\IAppManager;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\Storage\IStorage;
use OCP\IUser;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/** A folder of sidecars on a fake disk, and the `SidecarWriter` that writes into it. */
trait FakeSidecarFolder {
	private const string FOLDER = '/alice/files/Photos';
	private const int NEW_ID = 99;

	/** @var array<string, string> bytes by name in the folder */
	private array $disk = ['IMG_0001.NEF' => 'raw', 'IMG_0001.NEF.xmp' => 'old', 'IMG_0002.JPG' => 'jpeg'];
	/** @var list<string> */
	private array $events = [];
	/** @var array<string, \Throwable> failures by step: `newFile`, `move`, `delete` */
	private array $failures = [];
	/** Runs right after the part file is written, as another program could. */
	private ?\Closure $afterWrite = null;
	private bool $creatable = true;
	private bool $updateable = true;
	/** Whether the sidecar's owner has `files_versions` on; the user always has. */
	private bool $versions = true;
	private string $owner = 'alice';

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
		$file->method('getEtag')->willReturn(md5($this->disk[$name]));
		$file->method('getSize')->willReturn(strlen($this->disk[$name]));
		$file->method('getMTime')->willReturn(1_700_000_000 + count($this->events));
		$file->method('isUpdateable')->willReturn($this->updateable);
		$file->method('getParent')->willReturn($folder);
		$file->method('getOwner')->willReturn($this->user($this->owner));
		$file->method('getStorage')->willReturn($this->createStub(IStorage::class));
		return $file;
	}

	private function part(string $name, Folder $folder): File {
		$part = $this->createStub(File::class);
		$part->method('move')->willReturnCallback(function (string $target) use ($name, $folder): Node {
			$this->failOn('move');
			$this->assertSame(self::FOLDER . '/' . substr($name, 0, -strlen('.part')), $target);
			$this->disk[basename($target)] = $this->disk[$name];
			unset($this->disk[$name]);
			$this->events[] = "move $name";
			return $this->node(basename($target), $folder);
		});
		$part->method('delete')->willReturnCallback(function () use ($name): void {
			$this->failOn('delete');
			unset($this->disk[$name]);
			$this->events[] = "delete $name";
		});
		return $part;
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
		$folder->method('nodeExists')->willReturnCallback(fn (string $name): bool => isset($this->disk[$name]));
		$folder->method('newFile')->willReturnCallback(function (string $name, string $content) use ($folder): File {
			$this->failOn('newFile');
			$this->disk[$name] = $content;
			$this->events[] = "write $name";
			if ($this->afterWrite !== null) {
				($this->afterWrite)();
			}
			return $this->part($name, $folder);
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
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(fn (string $app, ?IUser $user): bool => $app === 'files_versions' && ($user?->getUID() !== $this->owner || $this->versions));
		$backends = $this->createStub(VersionBackends::class);
		$backends->method('existFor')->willReturn(true);
		return new SidecarWriter(new UserPhotos(new UserFolderResolver($root)), new FileVersions($apps, $backends), $logger ?? $this->createStub(LoggerInterface::class));
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
