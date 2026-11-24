<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Folder;

use OCA\Honeycomb\Domain\FolderDone;
use OCA\Honeycomb\Domain\FolderSummary;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\LibraryFolder;
use OCA\Honeycomb\Service\Files\FolderNotReadableException;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Folder\LibraryFolderService;
use OCA\Honeycomb\Service\Listing\CaptureTimes;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFolderDoneStore;
use OCA\Honeycomb\Tests\Service\FakeFolderSummaryStore;
use OCA\Honeycomb\Tests\Service\FakeLibraryFiles;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use OCP\FilesMetadata\IFilesMetadataManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class LibraryFolderServiceTest extends TestCase {
	use FakeFiles;

	private const int NOW = 1_800_000_000;

	private FakeLibraryFiles $files;
	private FakeFolderSummaryStore $summaries;
	private FakeFolderDoneStore $done;
	/** @var array<int, int> capture times by file id */
	private array $captureTimes = [];

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeLibraryFiles();
		$this->summaries = new FakeFolderSummaryStore();
		$this->done = new FakeFolderDoneStore();
	}

	/** @param array<string, \OCP\Files\Node|\Throwable> $nodes */
	private function service(array $nodes = []): LibraryFolderService {
		$metadata = $this->createStub(IFilesMetadataManager::class);
		$metadata->method('getMetadataForFiles')->willReturnCallback(fn (array $ids): array => array_map(
			fn (int $time): \OCP\FilesMetadata\Model\IFilesMetadata => $this->metadata([CaptureTimes::KEY => $time]),
			array_intersect_key($this->captureTimes, array_flip($ids)),
		));
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		$root = $this->rootWith($nodes + ['/Photos' => $this->folder('/Photos', fileId: 10)]);
		return new LibraryFolderService(new UserFolderResolver($root), $this->files, $this->summaries, $this->done, new CaptureTimes($metadata), $time);
	}

	private function libraryFolder(int $fileId, string $path, string $etag = 'e', int $permissions = Constants::PERMISSION_ALL): LibraryFolder {
		return new LibraryFolder($fileId, $path, "$etag-$fileId", $permissions);
	}

	private function summary(int $fileId, string $etag = 'e', int $photos = 4): FolderSummary {
		return new FolderSummary($fileId, "$etag-$fileId", $photos, 100, 60, 1, 1_600_000_000, 1_600_000_100, 1_700_000_000, self::NOW - 60);
	}

	// spec: FOLDERS-005.1, FOLDERS-005.2, FOLDERS-005.3, FOLDERS-005.4
	public function testAScanStoresEachFoldersSummaryAtItsEtag(): void {
		$this->files->folders = [$this->libraryFolder(10, ''), $this->libraryFolder(11, '/2024')];
		$this->files->photos = [
			['fileId' => 1, 'parent' => 10, 'name' => 'a.jpg', 'size' => 3, 'mtime' => 50],
			['fileId' => 2, 'parent' => 10, 'name' => 'a.nef', 'size' => 25, 'mtime' => 40],
			['fileId' => 3, 'parent' => 10, 'name' => 'b.jpg', 'size' => 4, 'mtime' => 30],
		];
		$this->captureTimes = [1 => 1_000, 2 => 1_000, 3 => 1_002];

		$this->service()->scan($this->user(), 'Photos');

		$this->assertEquals([
			10 => new FolderSummary(10, 'e-10', 2, 32, 25, 1, 1_000, 1_002, 50, self::NOW),
			11 => new FolderSummary(11, 'e-11', 0, 0, 0, 0, null, null, null, self::NOW),
		], $this->summaries->rows);
	}

	// spec: FOLDERS-005.5
	public function testAScanTakesAFixedBatchOfFoldersInPathOrder(): void {
		$paths = array_map(static fn (int $n): string => sprintf('/f%02d', $n), range(1, 60));
		shuffle($paths);
		foreach ($paths as $index => $path) {
			$this->files->folders[] = $this->libraryFolder(100 + $index, $path);
		}
		$byPath = array_column(array_map(static fn (LibraryFolder $folder): array => [$folder->path, $folder->fileId], $this->files->folders), 1, 0);
		ksort($byPath);

		$first = $this->service()->scan($this->user(), '/Photos');

		$this->assertSame(['scanning' => ['done' => 50, 'total' => 60]], $first);
		$this->assertSame(array_slice(array_values($byPath), 0, 50), $this->files->photoCalls[0]);
		$this->assertSame(['scanning' => ['done' => 60, 'total' => 60]], $this->service()->scan($this->user(), '/Photos'));
		$this->assertSame(array_slice(array_values($byPath), 50), $this->files->photoCalls[1]);
	}

	// spec: FOLDERS-005.6
	public function testOnlyAStaleSummaryIsScannedAgainAndListedUntilThen(): void {
		$this->files->folders = [$this->libraryFolder(10, ''), $this->libraryFolder(11, '/2024', 'new')];
		$this->summaries->rows = [10 => $this->summary(10), 11 => $this->summary(11, 'old')];

		$list = $this->service()->list($this->user(), '/Photos', '', '');

		$this->assertSame([10, 11], array_column($list['folders'], 'fileId'));
		$this->assertSame(['done' => 1, 'total' => 2], $list['scanning']);

		$this->service()->scan($this->user(), '/Photos');

		$this->assertSame([[11]], $this->files->photoCalls);
		$this->assertSame('new-11', $this->summaries->rows[11]->etag);
		$this->assertEquals($this->summary(10), $this->summaries->rows[10]);
	}

	// spec: FOLDERS-005.7, APP-004.3
	public function testTheListPagesByFileIdAndLeavesOutFoldersWithoutPhotos(): void {
		$this->files->folders = [$this->libraryFolder(13, '/c'), $this->libraryFolder(10, ''), $this->libraryFolder(12, '/b'), $this->libraryFolder(11, '/a'), $this->libraryFolder(14, '/d')];
		$this->summaries->rows = [10 => $this->summary(10), 11 => $this->summary(11, photos: 0), 12 => $this->summary(12), 13 => $this->summary(13)];

		$first = $this->service()->list($this->user(), '/Photos', '', '2');
		$second = $this->service()->list($this->user(), '/Photos', (string)$first['nextCursor'], '2');

		$this->assertSame([[10, 12], 12], [array_column($first['folders'], 'fileId'), $first['nextCursor']]);
		$this->assertSame([[13], null], [array_column($second['folders'], 'fileId'), $second['nextCursor']]);
	}

	// spec: FOLDERS-005.8, FOLDERS-005.10, FOLDERS-005.11
	public function testARowCarriesItsSummaryPermissionsAndDoneStatus(): void {
		$this->files->folders = [$this->libraryFolder(10, ''), $this->libraryFolder(11, '/2024', permissions: Constants::PERMISSION_READ)];
		$this->summaries->rows = [10 => $this->summary(10), 11 => $this->summary(11)];
		$this->done->rows = [11 => new FolderDone(11, 'bob', 1_750_000_000, 3)];

		$list = $this->service()->list($this->user(), 'Photos/', '0', '200');

		$this->assertNull($list['scanning']);
		$this->assertSame([
			['fileId' => 10, 'root' => '/Photos', 'path' => '/Photos', 'photos' => 4, 'bytes' => 100, 'rawBytes' => 60, 'bursts' => 1, 'oldest' => 1_600_000_000, 'newest' => 1_600_000_100, 'lastActivity' => 1_700_000_000, 'picked' => 0, 'rejected' => 0, 'undecided' => 4, 'permissions' => Constants::PERMISSION_ALL, 'done' => null],
			['fileId' => 11, 'root' => '/Photos', 'path' => '/Photos/2024', 'photos' => 4, 'bytes' => 100, 'rawBytes' => 60, 'bursts' => 1, 'oldest' => 1_600_000_000, 'newest' => 1_600_000_100, 'lastActivity' => 1_700_000_000, 'picked' => 0, 'rejected' => 0, 'undecided' => 4, 'permissions' => Constants::PERMISSION_READ, 'done' => ['by' => 'bob', 'at' => 1_750_000_000, 'photos' => 3]],
		], $list['folders']);
	}

	// spec: FOLDERS-005.9
	public function testCountsTheRequestingUsersDecisionsLive(): void {
		$this->files->folders = [$this->libraryFolder(10, ''), $this->libraryFolder(11, '/2024')];
		$this->summaries->rows = [10 => $this->summary(10, photos: 6), 11 => $this->summary(11, photos: 1)];
		$this->files->decisions = [
			'alice' => [
				['parent' => 10, 'name' => 'a.jpg', 'flag' => 'picked', 'updatedAt' => 2, 'doneSeries' => false],
				['parent' => 10, 'name' => 'b.jpg', 'flag' => 'rejected', 'updatedAt' => 2, 'doneSeries' => false],
				['parent' => 10, 'name' => 'c.jpg', 'flag' => null, 'updatedAt' => null, 'doneSeries' => true],
				['parent' => 11, 'name' => 'x.jpg', 'flag' => 'picked', 'updatedAt' => 2, 'doneSeries' => false],
				['parent' => 11, 'name' => 'y.jpg', 'flag' => 'picked', 'updatedAt' => 2, 'doneSeries' => false],
			],
			'bob' => [['parent' => 10, 'name' => 'd.jpg', 'flag' => null, 'updatedAt' => null, 'doneSeries' => true]],
		];

		$rows = $this->service()->list($this->user(), '/Photos', '', '')['folders'];

		$this->assertSame([[1, 1, 3], [2, 0, 0]], array_map(static fn (array $row): array => [$row['picked'], $row['rejected'], $row['undecided']], $rows));
	}

	/** @return array<string, array{string}> */
	public static function foreignRoots(): array {
		return ['missing' => ['/Nope'], 'a file' => ['/Photos/a.jpg'], 'parent segment' => ['/Photos/../x'], 'a share' => ['/Shared']];
	}

	// spec: FOLDERS-005.13
	#[DataProvider('foreignRoots')]
	public function testARootOutsideTheHomeStorageIsRefused(string $root): void {
		$nodes = ['/Photos/a.jpg' => $this->file(1, '/Photos/a.jpg'), '/Shared' => $this->folder('/Shared', mountType: 'shared', fileId: 20)];

		try {
			$this->service($nodes)->scan($this->user(), $root);
			$this->fail('the scan of a foreign root ran');
		} catch (InvalidRequestException) {
		}
		$this->expectException(InvalidRequestException::class);
		$this->service($nodes)->list($this->user(), $root, '', '');
	}

	// spec: FOLDERS-005.13
	public function testAnUnreadableRootIsForbidden(): void {
		$this->expectException(FolderNotReadableException::class);

		$this->service(['/Locked' => $this->folder('/Locked', readable: false)])->list($this->user(), '/Locked', '', '');
	}

	/** @return array<string, array{string, string}> */
	public static function malformedPages(): array {
		return ['negative after' => ['-1', ''], 'text after' => ['x', ''], 'zero limit' => ['', '0'], 'limit above 200' => ['', '201'], 'fraction limit' => ['', '1.5']];
	}

	// spec: FOLDERS-005.14
	#[DataProvider('malformedPages')]
	public function testAMalformedPageIsRefused(string $after, string $limit): void {
		$this->expectException(InvalidRequestException::class);

		$this->service()->list($this->user(), '/Photos', $after, $limit);
	}
}
