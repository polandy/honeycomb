<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\App\IAppManager;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServiceStatsTest extends TestCase {
	use FakeTree;
	use StatsFixture;

	private function service(): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn(true);
		$this->addFiles([1 => '/In/A.RAF', 2 => '/In/A.JPG', 3 => '/In/B.JPG', 4 => '/In/C.RAF', 5 => '/In/C.JPG']);
		return new MoveService(new UserPhotos(new UserFolderResolver($this->treeRoot())), $apps, new FileRowStores(new FakeFlagStore(), new FakeVisualHashStore(), new FakeSeriesStore(), new FakeXmpCacheStore()), $this->createStub(LoggerInterface::class), $this->stats());
	}

	/** @return array{fileId: int, etag: string, path: string} */
	private static function to(int $fileId, string $path): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'path' => $path];
	}

	/** @return list<list<array{fileId: int, etag: string, path: string}>> */
	private static function request(): array {
		return [
			[self::to(1, '/Out/A.RAF'), self::to(2, '/Out/A.JPG')],
			[self::to(3, '/Out/B.JPG')],
			[self::to(4, '/Out/C.RAF'), self::to(5, '/Out/C.JPG')],
		];
	}

	// spec: STATS-001.10, STATS-001.31
	public function testCountsOnlyThePicturesWhoseFilesAllMoved(): void {
		$service = $this->service();
		$this->moveFailures[5] = new LockedException('C.JPG');

		$service->move($this->treeUser(), self::request());

		$this->assertSame(['pictures_moved' => 2], $this->counted());
	}

	// spec: STATS-001.7
	public function testAFailedCountLeavesTheMoveAndItsAnswerAsTheyAre(): void {
		$service = $this->service();
		$this->failCounting();

		$results = $service->move($this->treeUser(), [[self::to(3, '/Out/B.JPG')]]);

		$this->assertSame('moved', $results[0][0]['result']->value);
		$this->assertSame('/Out/B.JPG', $this->files[3]);
		$this->assertSame(['Could not count the statistics.'], $this->statsWarnings);
	}
}
