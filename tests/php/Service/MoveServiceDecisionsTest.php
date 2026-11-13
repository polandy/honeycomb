<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\TagStore;
use OCP\App\IAppManager;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class MoveServiceDecisionsTest extends TestCase {
	use FakeTree;

	private FakeDecisionStore $store;
	private FakeTagStore $tags;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeDecisionStore();
		$this->tags = new FakeTagStore();
		$this->addFiles([1 => '/In/A.RAF', 2 => '/In/A.JPG']);
	}

	private function service(?DecisionStore $store = null, ?LoggerInterface $logger = null, ?TagStore $tags = null): MoveService {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn(true);
		return new MoveService($this->treeRoot(), $apps, $store ?? $this->store, $tags ?? $this->tags, $logger ?? $this->createStub(LoggerInterface::class));
	}

	private static function decision(int $fileId): PictureDecision {
		return new PictureDecision($fileId, 4, null, Flag::Picked, false);
	}

	/** @return list<list<array{fileId: int, etag: string, path: string}>> the pair to `/Out` */
	private static function request(): array {
		return [[
			['fileId' => 1, 'etag' => 'etag-1', 'path' => '/Out/A.RAF'],
			['fileId' => 2, 'etag' => 'etag-2', 'path' => '/Out/A.JPG'],
		]];
	}

	// spec: MOVE-002.10
	public function testADecisionFollowsItsFileToANewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->store->rows = ['alice' => [1 => self::decision(1), 2 => self::decision(2)], 'bob' => [2 => self::decision(2)]];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertEquals(['alice' => [1 => self::decision(1), 20 => self::decision(20)], 'bob' => [2 => self::decision(2)]], $this->store->rows);
	}

	// spec: MOVE-002.10
	public function testADecisionFollowsItsFileWhenItMovesBackToAnotherNewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds = [1 => 10, 10 => 11];
		$this->moveFailures[2] = new NotPermittedException();
		$this->store->rows = ['alice' => [1 => self::decision(1)]];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertSame('/In/A.RAF', $this->files[11]);
		$this->assertEquals(['alice' => [11 => self::decision(11)]], $this->store->rows);
	}

	// spec: MOVE-002.10
	public function testADecisionThatCannotBeCarriedOverIsLoggedAndTheFileStaysMoved(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$failure = new \RuntimeException('database gone');
		$store = $this->createStub(DecisionStore::class);
		$store->method('carryOver')->willThrowException($failure);
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->anything(), ['fileId' => 2, 'newFileId' => 20, 'exception' => $failure]);

		$results = $this->service($store, $logger)->move($this->treeUser(), self::request());

		$this->assertSame(['moved', 'moved'], array_map(static fn (array $file): string => $file['result']->value, $results[0]));
		$this->assertSame('/Out/A.JPG', $this->files[20]);
	}

	// spec: TAGS-001.10
	public function testTagsFollowTheirFileToANewFileId(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->tags->rows = ['alice' => [2 => new PictureTags(2, ['Anna'])]];

		$this->service()->move($this->treeUser(), self::request());

		$this->assertEquals(['alice' => [20 => new PictureTags(20, ['Anna'])]], $this->tags->rows);
	}

	// spec: TAGS-001.10
	public function testTagsThatCannotBeCarriedOverAreLoggedAndTheDecisionStillFollows(): void {
		$this->addFolder('/Out');
		$this->newIds[2] = 20;
		$this->store->rows = ['alice' => [2 => self::decision(2)]];
		$failure = new \RuntimeException('database gone');
		$tags = $this->createStub(TagStore::class);
		$tags->method('carryOver')->willThrowException($failure);
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')->with($this->anything(), ['fileId' => 2, 'newFileId' => 20, 'exception' => $failure]);

		$results = $this->service(logger: $logger, tags: $tags)->move($this->treeUser(), self::request());

		$this->assertSame(['moved', 'moved'], array_map(static fn (array $file): string => $file['result']->value, $results[0]));
		$this->assertEquals(['alice' => [20 => self::decision(20)]], $this->store->rows);
	}
}
