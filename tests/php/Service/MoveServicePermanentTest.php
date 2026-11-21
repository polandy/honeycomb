<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\App\IAppManager;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServicePermanentTest extends TestCase {
	use StatsFixture;
	use FakeTree;

	/** @var list<array{string, array<array-key, mixed>}> */
	private array $warnings = [];

	private function service(bool $trashBin = true): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn($trashBin);
		$logger = $this->createStub(LoggerInterface::class);
		$logger->method('warning')->willReturnCallback(function (string|\Stringable $message, array $context = []): void {
			$this->warnings[] = [(string)$message, $context];
		});
		return new MoveService(new UserPhotos(new UserFolderResolver($this->treeRoot())), $apps, new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore(), new FakeQualityStore()), $logger, $this->stats(), $this->treeTrashBin('800'));
	}

	/** @return array{fileId: int, etag: string, path: string, replace: array{fileId: int, etag: string, permanent: bool}} */
	private static function replacing(int $fileId, string $path, int $replaceId): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'path' => $path, 'replace' => ['fileId' => $replaceId, 'etag' => "etag-$replaceId", 'permanent' => true]];
	}

	/** @return array{fileId: int, result: string, replaced: bool, path: string, newFileId: int, etag: string} */
	private static function replaced(int $fileId, string $path): array {
		return ['fileId' => $fileId, 'result' => 'moved', 'replaced' => true, 'path' => $path, 'newFileId' => $fileId, 'etag' => "etag-$fileId"];
	}

	// spec: MOVE-002.13
	public function testAReplaceMarkedPermanentDeletesForGoodWhatTheTrashBinWouldNotKeep(): void {
		$this->addFiles([2 => '/In/A.JPG', 4 => '/In/B.JPG', 6 => '/In/C.JPG', 9 => '/Out/A.JPG', 8 => '/Out/B.JPG', 5 => '/Out/C.JPG']);
		$this->noTrashBin[9] = true;

		$results = $this->service()->move($this->treeUser(), [
			[self::replacing(2, '/Out/A.JPG', 9)],
			[self::replacing(4, '/Out/B.JPG', 8)],
			[self::replacing(6, '/Out/C.JPG', 5)],
		]);

		$this->assertSame([[self::replaced(2, '/Out/A.JPG')], [self::replaced(4, '/Out/B.JPG')], [self::replaced(6, '/Out/C.JPG')]], json_decode(json_encode($results, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR));
		$this->assertSame([9, 8, 5], $this->trashed);
		$this->assertSame([
			['A file was replaced permanently', ['fileId' => 9, 'user' => 'alice']],
			['A file was replaced permanently', ['fileId' => 8, 'user' => 'alice']],
		], $this->warnings);
	}

	// spec: MOVE-002.5
	public function testAReplaceNotMarkedPermanentIsStillRefused(): void {
		$this->addFiles([2 => '/In/A.JPG', 9 => '/Out/A.JPG']);
		$this->noTrashBin[9] = true;
		$file = self::replacing(2, '/Out/A.JPG', 9);
		$file['replace']['permanent'] = false;

		$results = $this->service()->move($this->treeUser(), [[$file]]);

		$this->assertSame([[['fileId' => 2, 'result' => 'noTrashBin', 'replaced' => false]]], json_decode(json_encode($results, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR));
		$this->assertSame([], $this->trashed);
		$this->assertSame([], $this->warnings);
	}

	// spec: MOVE-002.7
	public function testWithTheTrashBinOffAPermanentReplaceIsRefusedWhole(): void {
		$this->addFiles([2 => '/In/A.JPG', 9 => '/Out/A.JPG']);
		$this->noTrashBin[9] = true;

		try {
			$this->service(trashBin: false)->move($this->treeUser(), [[self::replacing(2, '/Out/A.JPG', 9)]]);
			$this->fail('The move must be refused');
		} catch (TrashBinDisabledException) {
			$this->assertSame([], $this->trashed);
			$this->assertSame('/In/A.JPG', $this->files[2]);
		}
	}
}
