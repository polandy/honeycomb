<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Move;

use OCA\Honeycomb\Domain\Store\FileRowStores;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Move\MoveService;
use OCA\Honeycomb\Tests\Service\FakeFileRowCarryOver;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeFolderDoneStore;
use OCA\Honeycomb\Tests\Service\FakeFolderSummaryStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeSeriesStore;
use OCA\Honeycomb\Tests\Service\FakeTree;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\App\IAppManager;
use Psr\Log\LoggerInterface;

/** The service under test, a RAW+JPEG pair and the request and result shapes of a move. */
trait MoveFixture {
	use StatsFixture;
	use FakeTree;

	private function service(bool $trashBin = true, ?LoggerInterface $logger = null, string $trashBinSize = '-1'): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturnCallback(static fn (string $app): bool => $app === 'files_trashbin' && $trashBin);
		return new MoveService(new UserPhotos(new UserFolderResolver($this->treeRoot())), $apps, new FakeFileRowCarryOver(new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore(), new FakeFolderSummaryStore(), new FakeFolderDoneStore())), $logger ?? $this->createStub(LoggerInterface::class), $this->stats(), $this->treeTrashBin($trashBinSize));
	}

	/** A RAW, its JPEG and the RAW's sidecar in `/In`, and a single JPEG. */
	private function pair(): void {
		$this->addFiles([1 => '/In/A.RAF', 2 => '/In/A.JPG', 3 => '/In/A.RAF.xmp', 4 => '/In/B.JPG']);
	}

	/** @return array{fileId: int, etag: string, path: string, replace?: array{fileId: int, etag: string}} the request form of a file: its id, listed ETag and new path */
	private static function to(int $fileId, string $path): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'path' => $path];
	}

	/**
	 * The pair's files to `/Out/2026`, the sidecar first, and the single JPEG to `/Out/B.JPG`.
	 * @return list<list<array{fileId: int, etag: string, path: string, replace?: array{fileId: int, etag: string}}>>
	 */
	private static function request(): array {
		return [
			[self::to(3, '/Out/2026/X.RAF.xmp'), self::to(1, '/Out/2026/X.RAF'), self::to(2, '/Out/2026/X.JPG')],
			[self::to(4, '/Out/B.JPG')],
		];
	}

	/** @return list<list<array<string, mixed>>> */
	private static function results(array $pictures): array {
		/** @var list<list<array<string, mixed>>> */
		return json_decode(json_encode($pictures, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}

	/** @return array{fileId: int, result: string, replaced: bool, path: string, newFileId: int, etag: string} */
	private static function moved(int $fileId, string $path, ?int $newFileId = null, bool $replaced = false): array {
		$newFileId ??= $fileId;
		return ['fileId' => $fileId, 'result' => 'moved', 'replaced' => $replaced, 'path' => $path, 'newFileId' => $newFileId, 'etag' => "etag-$newFileId"];
	}

	/** @return array{fileId: int, result: string, replaced: bool} */
	private static function failedFile(int $fileId, string $result, bool $replaced = false): array {
		return ['fileId' => $fileId, 'result' => $result, 'replaced' => $replaced];
	}
}
