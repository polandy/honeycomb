<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FlagStore;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\QualityValue;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Service\VisualHash;
use OCP\App\IAppManager;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServiceCarryOverTest extends TestCase {
	use StatsFixture;
	use FakeTree;

	private FakeFlagStore $flags;
	private FakeVisualHashStore $hashes;
	private FakeQualityStore $quality;
	private FakeSeriesStore $series;

	#[\Override]
	protected function setUp(): void {
		$this->flags = new FakeFlagStore();
		$this->hashes = new FakeVisualHashStore();
		$this->quality = new FakeQualityStore();
		$this->series = new FakeSeriesStore();
		$this->addFiles([1 => '/In/A.RAF', 2 => '/In/A.JPG']);
	}

	private function service(?FlagStore $flags = null, ?LoggerInterface $logger = null): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn(true);
		return new MoveService(new UserPhotos(new UserFolderResolver($this->treeRoot())), $apps, new FileRowStores($flags ?? $this->flags, $this->hashes, $this->series, new FakeXmpCacheStore(), $this->quality), $logger ?? $this->createStub(LoggerInterface::class), $this->stats(), $this->treeTrashBin());
	}

	private static function flag(int $fileId): FileFlag {
		return new FileFlag($fileId, Flag::Picked, true, 100);
	}

	/** @return list<list<array{fileId: int, etag: string, path: string}>> the pair to `/Out` */
	private static function request(): array {
		return [[
			['fileId' => 1, 'etag' => 'etag-1', 'path' => '/Out/A.RAF'],
			['fileId' => 2, 'etag' => 'etag-2', 'path' => '/Out/A.JPG'],
		]];
	}

	// spec: MOVE-002.10
	public function testAFlagFollowsItsFileToANewFileIdWhoeverSetIt(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->flags->rows = [1 => self::flag(1), 2 => self::flag(2)];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertEquals([1 => self::flag(1), 20 => self::flag(20)], $this->flags->rows);
	}

	// spec: MOVE-002.10
	public function testAFlagFollowsItsFileWhenItMovesBackToAnotherNewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds = [1 => 10, 10 => 11];
		$this->moveFailures[2] = new NotPermittedException();
		$this->flags->rows = [1 => self::flag(1)];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertSame('/In/A.RAF', $this->files[11]);
		$this->assertEquals([11 => self::flag(11)], $this->flags->rows);
	}

	// spec: MOVE-002.10
	public function testAFlagThatCannotBeCarriedOverIsLoggedAndTheFileStaysMoved(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$failure = new \RuntimeException('database gone');
		$flags = $this->createStub(FlagStore::class);
		$flags->method('carryOver')->willThrowException($failure);
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->anything(), ['fileId' => 2, 'newFileId' => 20, 'exception' => $failure]);

		$results = $this->service($flags, $logger)->move($this->treeUser(), self::request());

		$this->assertSame(['moved', 'moved'], array_map(static fn (array $file): string => $file['result']->value, $results[0]));
		$this->assertSame('/Out/A.JPG', $this->files[20]);
	}

	// spec: MOVE-002.10
	public function testTheUsersOtherRowsFollowAndAnotherUsersStay(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->series->add('alice', SeriesStatus::Open, 2);
		$this->series->add('bob', SeriesStatus::Open, 2);
		$this->flags->rows = [2 => self::flag(2)];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertSame([20], array_keys($this->series->rows['alice']));
		$this->assertSame([2], array_keys($this->series->rows['bob']));
		$this->assertEquals([20 => self::flag(20)], $this->flags->rows);
	}

	// spec: SERIES-003.15
	public function testAVisualHashFollowsItsFileToANewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->hashes->rows = [2 => new VisualHash(2, 'etag-2', '00ff00ff00ff00ff')];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertEquals([20 => new VisualHash(20, 'etag-2', '00ff00ff00ff00ff')], $this->hashes->rows);
	}

	// spec: SERIES-006.14
	public function testAQualityValueFollowsItsFileToANewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->quality->rows = [2 => new QualityValue(2, 'etag-2', 1, 5.5, 9)];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertEquals([20 => new QualityValue(20, 'etag-2', 1, 5.5, 9)], $this->quality->rows);
	}

	// spec: SERIES-005.25
	public function testASeriesMemberFollowsItsFileToANewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$id = $this->series->add('alice', SeriesStatus::Open, 1, 2);

		$this->service()->move($this->treeUser(), self::request());

		$this->assertSame(['alice' => [1 => $id, 20 => $id]], $this->series->rows);
	}
}
