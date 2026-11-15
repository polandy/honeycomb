<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\MoveService;
use OCP\App\IAppManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServiceStorageTest extends TestCase {
	use FakeTree;

	private function service(): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn(true);
		return new MoveService($this->treeRoot(), $apps, new FileRowStores(new FakeDecisionStore(), new FakeTagStore(), new FakeVisualHashStore(), new FakeSeriesStore()), $this->createStub(LoggerInterface::class));
	}

	/** @return array{fileId: int, etag: string, path: string} */
	private static function to(int $fileId, string $path): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'path' => $path];
	}

	/** @return list<list<array<string, mixed>>> */
	private static function results(array $pictures): array {
		/** @var list<list<array<string, mixed>>> */
		return json_decode(json_encode($pictures, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}

	/** @return array<string, array{string, string}> */
	public static function storageChanges(): array {
		return [
			'out of an incoming share into the home' => ['/Shared/Shoot', '/Out'],
			'from the home into a group folder' => ['/In', '/Group/2026'],
			'from one share into another' => ['/Shared/Shoot', '/Group'],
			'into a new folder below a share' => ['/In', '/Shared/New/2026'],
		];
	}

	// spec: MOVE-002.11
	#[DataProvider('storageChanges')]
	public function testAMoveToAnotherStorageLeavesThePictureUntouched(string $from, string $to): void {
		$this->addFiles([1 => "$from/A.RAF", 2 => "$from/A.JPG", 4 => '/Shared/B.JPG']);
		$this->addFolder('/Group');
		$this->mounts = ['/Shared' => true, '/Group' => true];

		$results = $this->service()->move($this->treeUser(), [[self::to(1, "$to/A.RAF"), self::to(2, "$to/A.JPG")], [self::to(4, '/Shared/C.JPG')]]);

		$this->assertSame([
			[['fileId' => 1, 'result' => 'otherStorage', 'replaced' => false], ['fileId' => 2, 'result' => 'otherStorage', 'replaced' => false]],
			[['fileId' => 4, 'result' => 'moved', 'replaced' => false, 'path' => '/Shared/C.JPG', 'newFileId' => 4, 'etag' => 'etag-4']],
		], self::results($results));
		$this->assertSame(['move 4 /Shared/C.JPG'], $this->log);
	}

	// spec: MOVE-002.11
	public function testAReplaceOfAFileMountedFromAnotherStorageIsRefused(): void {
		$this->addFiles([1 => '/In/A.JPG', 9 => '/Out/A.JPG']);
		$this->mounts = ['/Out/A.JPG' => true];
		$request = self::to(1, '/Out/A.JPG') + ['replace' => ['fileId' => 9, 'etag' => 'etag-9']];

		$results = $this->service()->move($this->treeUser(), [[$request]]);

		$this->assertSame([[['fileId' => 1, 'result' => 'otherStorage', 'replaced' => false]]], self::results($results));
		$this->assertSame([], $this->trashed);
	}
}
