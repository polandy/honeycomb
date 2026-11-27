<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\BackgroundJob;

use OCA\Honeycomb\BackgroundJob\ReadRawHeaders;
use OCA\Honeycomb\Domain\FolderSummary;
use OCA\Honeycomb\Tests\Service\FakeFolderSummaryStore;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\FilesMetadata\Model\IFilesMetadata;
use OCP\IUserManager;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class ReadRawHeadersTest extends TestCase {
	private FakeFolderSummaryStore $summaries;
	/** @var list<array{int, int}> the refreshed file ids and their process flags */
	private array $refreshed = [];
	/** @var list<string> the warnings logged */
	private array $warnings = [];

	#[\Override]
	protected function setUp(): void {
		$this->summaries = new FakeFolderSummaryStore();
		foreach ([10, 11, 12] as $folderId) {
			$this->summaries->rows[$folderId] = new FolderSummary($folderId, 'e', 1, 1, 1, 0, null, null, null, 0);
		}
	}

	/**
	 * @param array<int, Node> $nodes alice's nodes by file id
	 * @param list<int> $unread the file ids whose refresh writes no key
	 * @param list<int> $failing the file ids whose refresh throws
	 */
	private function runJob(mixed $argument, array $nodes, array $unread = [], array $failing = []): void {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnCallback(static fn (string $userId): Folder => $userId === 'alice' ? $userFolder : throw new \LogicException("no files of $userId"));
		$users = $this->createStub(IUserManager::class);
		$users->method('userExists')->willReturnCallback(static fn (string $userId): bool => $userId === 'alice');
		$manager = $this->createStub(IFilesMetadataManager::class);
		$manager->method('refreshMetadata')->willReturnCallback(function (Node $node, int $process) use ($unread, $failing): IFilesMetadata {
			if (in_array($node->getId(), $failing, true)) {
				throw new \RuntimeException('storage gone');
			}
			$this->refreshed[] = [$node->getId(), $process];
			$metadata = $this->createStub(IFilesMetadata::class);
			$metadata->method('hasKey')->willReturn(!in_array($node->getId(), $unread, true));
			return $metadata;
		});
		$logger = $this->createStub(LoggerInterface::class);
		$logger->method('warning')->willReturnCallback(function (string $message): void {
			$this->warnings[] = $message;
		});
		$job = new ReadRawHeaders($this->createStub(ITimeFactory::class), $users, $root, $manager, $this->summaries, $logger);
		(new \ReflectionMethod($job, 'run'))->invoke($job, $argument);
	}

	private function file(int $id, int $parentId): File {
		$parent = $this->createStub(Folder::class);
		$parent->method('getId')->willReturn($parentId);
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getParent')->willReturn($parent);
		return $file;
	}

	// spec: LISTING-004.17
	public function testRefreshesEachFileAsOccDoesAndDropsTheSummariesOfTheirFolders(): void {
		$this->runJob(['userId' => 'alice', 'fileIds' => [1, 2, 3]], [1 => $this->file(1, 10), 2 => $this->file(2, 10), 3 => $this->file(3, 11)]);

		$both = IFilesMetadataManager::PROCESS_LIVE | IFilesMetadataManager::PROCESS_BACKGROUND;
		$this->assertSame([[1, $both], [2, $both], [3, $both]], $this->refreshed);
		$this->assertSame([12], array_keys($this->summaries->rows));
		$this->assertSame([], $this->warnings);
	}

	// spec: LISTING-004.17
	public function testSkipsAMissingFileAndAFolderAndLogsAFailedRefresh(): void {
		$folder = $this->createStub(Folder::class);
		$folder->method('getId')->willReturn(4);

		$this->runJob(['userId' => 'alice', 'fileIds' => [1, 2, 3, 4]], [2 => $this->file(2, 10), 3 => $this->file(3, 11), 4 => $folder], failing: [2]);

		$this->assertSame([3], array_column($this->refreshed, 0));
		$this->assertSame([10, 12], array_keys($this->summaries->rows));
		$this->assertSame(['Could not read the RAW header of a file'], $this->warnings);
	}

	// spec: LISTING-004.17
	public function testKeepsTheSummaryOfAFolderWhoseFilesGotNoKey(): void {
		$this->runJob(['userId' => 'alice', 'fileIds' => [1, 2]], [1 => $this->file(1, 10), 2 => $this->file(2, 11)], unread: [1]);

		$this->assertSame([10, 12], array_keys($this->summaries->rows));
	}

	// spec: LISTING-004.17
	public function testLogsAnArgumentWithoutAUserAndFileIdsAndDoesNothing(): void {
		foreach ([null, ['userId' => 'alice'], ['userId' => 'alice', 'fileIds' => ['1']], ['userId' => 3, 'fileIds' => [1]]] as $argument) {
			$this->runJob($argument, [1 => $this->file(1, 10)]);
		}

		$this->assertSame([], $this->refreshed);
		$this->assertSame(array_fill(0, 4, 'RAW header job without a user and file ids'), $this->warnings);
		$this->assertCount(3, $this->summaries->rows);
	}

	// spec: LISTING-004.17
	public function testLogsAUserWhoIsGone(): void {
		$this->runJob(['userId' => 'bob', 'fileIds' => [1]], []);

		$this->assertSame([], $this->refreshed);
		$this->assertSame(['RAW header job for a user without files'], $this->warnings);
	}
}
