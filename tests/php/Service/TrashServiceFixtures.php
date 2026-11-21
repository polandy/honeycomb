<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\TrashBinGuard;
use OCA\Honeycomb\Service\TrashNameSpacing;
use OCA\Honeycomb\Service\TrashService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\App\IAppManager;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\Files\File;
use OCP\Files\FileInfo;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\Storage\IStorage;
use OCP\IAppConfig;
use OCP\IUser;
use Psr\Log\LoggerInterface;

/** Alice's files and a `TrashService` over them, for the tests of `TrashService`. */
trait TrashServiceFixtures {
	use StatsFixture;

	/** @var list<int> file ids in the order they were trashed */
	private array $trashed = [];

	/** @var array<int, int> the clock's second at the end of each file's delete, by file id */
	private array $trashedAt = [];

	private ?FakeClock $clock = null;

	private ?FakeFlagStore $flags = null;

	/** The flag rows the service checks and removes. */
	private function flags(): FakeFlagStore {
		return $this->flags ??= new FakeFlagStore();
	}

	private function clock(): FakeClock {
		return $this->clock ??= new FakeClock();
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	/** A file of alice's that records its delete, or throws `$failure` instead, and has no id once deleted, as in Nextcloud; `$size` bytes against a trash bin size of 1000, unreadable after `$sizeReads` reads; its delete takes `$seconds`. */
	private function file(int $id, string $name, string $mime = 'image/jpeg', bool $deletable = true, ?\Throwable $failure = null, int $size = 1, bool $trashBin = true, int $seconds = 0, int $sizeReads = PHP_INT_MAX): File {
		$storage = $this->createStub(IStorage::class);
		$storage->method('instanceOfStorage')->willReturnCallback(static fn (string $class): bool => $trashBin && $class === 'OCA\Files_Trashbin\Storage');
		$parent = $this->createStub(Folder::class);
		$parent->method('getFreeSpace')->willReturn(FileInfo::SPACE_UNLIMITED);
		$file = $this->createStub(File::class);
		$file->method('getParent')->willReturn($parent);
		$file->method('getStorage')->willReturn($storage);
		$file->method('getSize')->willReturnCallback(function () use ($id, $size, &$sizeReads): int {
			return in_array($id, $this->trashed, true) || $sizeReads-- <= 0 ? throw new NotFoundException() : $size;
		});
		$file->method('getId')->willReturnCallback(fn (): int => in_array($id, $this->trashed, true) ? throw new NotFoundException() : $id);
		$file->method('getName')->willReturn($name);
		$file->method('getMimetype')->willReturn($mime);
		$file->method('getEtag')->willReturn("etag-$id");
		$file->method('isDeletable')->willReturn($deletable);
		$file->method('delete')->willReturnCallback(function () use ($id, $failure, $seconds): void {
			$this->clock()->now += $seconds;
			if ($failure !== null) {
				throw $failure;
			}
			$this->trashed[] = $id;
			$this->trashedAt[$id] = $this->clock()->now;
		});
		return $file;
	}

	/** @param array<int, Node> $nodes alice's nodes by file id */
	private function service(array $nodes, bool $trashBin = true, ?LoggerInterface $logger = null): TrashService {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app): bool => $app === 'files_trashbin' && $trashBin);
		$userConfig = $this->createStub(IUserConfig::class);
		$userConfig->method('getValueString')->willReturnArgument(3);
		$appConfig = $this->createStub(IAppConfig::class);
		$appConfig->method('getValueString')->willReturn('1000');
		$guard = new TrashBinGuard($userConfig, $appConfig);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->clock()->now);
		$spacing = new TrashNameSpacing($time, $this->clock());
		return new TrashService(new UserPhotos(new UserFolderResolver($root)), $apps, $guard, $spacing, $this->flags(), $logger ?? $this->createStub(LoggerInterface::class), $this->stats());
	}

	/**
	 * The request form of a picture: each file id with its listed ETag.
	 * @return list<array{fileId: int, etag: string}>
	 */
	private static function picture(int ...$fileIds): array {
		return array_values(array_map(static fn (int $id): array => ['fileId' => $id, 'etag' => "etag-$id"], $fileIds));
	}

	/** @return list<list<array{fileId: int, result: string}>> */
	private static function results(array $pictures): array {
		/** @var list<list<array{fileId: int, result: string}>> */
		return json_decode(json_encode($pictures, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}
}
