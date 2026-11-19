<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use PHPUnit\Framework\TestCase;

final class UserPhotosTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	/** @var list<list<int>> the file ids of each search of the user's folder */
	private array $searched = [];

	/** How often a single file id was looked up. */
	private int $singleLookups = 0;

	/** Photos whose user `alice` reaches `$nodes` by file id; `bob` reaches only file 50. */
	private function photos(Node ...$nodes): UserPhotos {
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([
			['alice', $this->folderWith($nodes)],
			['bob', $this->folderWith([$this->file(50, '/P/BOB.JPG')])],
		]);
		return new UserPhotos(new UserFolderResolver($root));
	}

	/** @param array<Node> $nodes */
	private function folderWith(array $nodes): Folder {
		$byId = [];
		foreach ($nodes as $node) {
			$byId[$node->getId()] = $node;
		}
		$find = static fn (int $id): ?Node => $byId[$id] ?? null;
		$folder = $this->folder('');
		$folder->method('getFirstNodeById')->willReturnCallback(function (int $id) use ($find): ?Node {
			$this->singleLookups++;
			return $find($id);
		});
		$folder->method('search')->willReturnCallback(self::fileIdSearch($find, $this->searched));
		return $folder;
	}

	// spec: SERIES-003.3
	public function testAnswersThePhotosAtTheirEtagInRequestOrder(): void {
		$photos = $this->photos($this->file(7, '/P/A.JPG'), $this->file(8, '/P/B.CR3', 'application/octet-stream'), $this->file(9, '/P/C.png', 'image/png'));

		$this->assertSame([9, 7, 8], $photos->current($this->user(), [9 => 'etag-9', 7 => 'etag-7', 8 => 'etag-8']));
	}

	// spec: SERIES-003.4
	public function testRejectsAFileIdTheUserDoesNotReach(): void {
		$this->assertSame([], $this->photos($this->file(7, '/P/A.JPG'))->current($this->user(), [404 => 'etag-404']));
	}

	// spec: SERIES-003.4
	public function testRejectsAnotherUsersPhoto(): void {
		$this->assertSame([7], $this->photos($this->file(7, '/P/A.JPG'))->current($this->user(), [50 => 'etag-50', 7 => 'etag-7']));
	}

	// spec: SERIES-003.4
	public function testRejectsAFolder(): void {
		$folder = $this->folder('/P/Sub');
		$folder->method('getId')->willReturn(5);
		$folder->method('getEtag')->willReturn('etag-5');

		$this->assertSame([], $this->photos($folder)->current($this->user(), [5 => 'etag-5']));
	}

	// spec: SERIES-003.4
	public function testRejectsAFileThatIsNoPhoto(): void {
		$photos = $this->photos($this->file(9, '/P/A.XMP', 'application/octet-stream'), $this->file(10, '/P/notes.txt', 'text/plain'));

		$this->assertSame([], $photos->current($this->user(), [9 => 'etag-9', 10 => 'etag-10']));
	}

	// spec: SERIES-003.5
	public function testRejectsAPhotoAtAnotherEtag(): void {
		$photos = $this->photos($this->file(7, '/P/A.JPG'), $this->file(8, '/P/B.JPG'));

		$this->assertSame([8], $photos->current($this->user(), [7 => 'etag-old', 8 => 'etag-8']));
	}

	public function testAnswersNothingForNoFileIds(): void {
		$this->assertSame([], $this->photos()->current($this->user(), []));
	}

	// spec: SERIES-005.24
	public function testAnswersTheFileIdsTheUserReachesAsPhotosInRequestOrder(): void {
		$folder = $this->folder('/P/Sub');
		$folder->method('getId')->willReturn(5);
		$photos = $this->photos($this->file(7, '/P/A.JPG'), $this->file(8, '/P/B.CR3', 'application/octet-stream'), $this->file(10, '/P/notes.txt', 'text/plain'), $folder);
		$this->assertSame([8, 7], $photos->photos($this->user(), [8, 404, 10, 5, 50, 7]));
	}

	// spec: XMP-006.11
	public function testLooksThePhotosUpAThousandIdsAtATime(): void {
		$fileIds = [...range(1, 2_499), 7_000];
		$photos = $this->photos($this->file(7_000, '/P/LAST.JPG'), $this->file(1_200, '/P/MID.CR3', 'application/octet-stream'));

		$this->assertSame([1_200, 7_000], $photos->photos($this->user(), $fileIds));
		$this->assertSame([range(1, 1_000), range(1_001, 2_000), [...range(2_001, 2_499), 7_000]], $this->searched);
		$this->assertSame(0, $this->singleLookups);
	}

	public function testLooksTheCurrentPhotosUpAThousandIdsAtATime(): void {
		$photos = $this->photos($this->file(1_500, '/P/A.JPG'));

		$this->assertSame([1_500], $photos->current($this->user(), array_fill_keys(range(1, 1_500), 'etag-1500')));
		$this->assertSame([range(1, 1_000), range(1_001, 1_500)], $this->searched);
		$this->assertSame(0, $this->singleLookups);
	}

	// spec: XMP-006.3, XMP-006.11
	public function testAnswersTheSidecarsAndJpegsInRequestOrderInBatches(): void {
		$photos = $this->photos($this->file(7, '/P/A.JPG'), $this->file(8, '/P/B.CR3', 'application/octet-stream'), $this->file(9, '/P/B.CR3.xmp', 'application/octet-stream'), $this->file(10, '/P/notes.txt', 'text/plain'), $this->file(11, '/P/C.jpg.XMP', 'application/octet-stream'));

		$this->assertSame([11, 9], $photos->sidecars($this->user(), [11, 7, 404, 9, 10]));
		$this->assertSame([7], $photos->jpegs($this->user(), [8, 9, 7, 50, 10]));
		$this->assertSame([[11, 7, 404, 9, 10], [8, 9, 7, 50, 10]], $this->searched);
		$this->assertSame([], $photos->sidecars($this->user(), []));
		$this->assertSame(0, $this->singleLookups);
	}

	public function testAnswersNoPhotosForNoFileIds(): void {
		$this->assertSame([], $this->photos()->photos($this->user(), []));
	}

	public function testFindsAPhotoInTheUsersFolder(): void {
		$raw = $this->file(8, '/P/B.CR3', 'application/octet-stream');
		$photos = $this->photos($raw, $this->file(9, '/P/B.CR3.xmp', 'application/octet-stream'));
		$userFolder = $photos->userFolder($this->user());

		$this->assertSame($raw, $photos->photo($userFolder, 8));
		$this->assertNull($photos->photo($userFolder, 9));
		$this->assertNull($photos->photo($userFolder, 404));
	}

	public function testFindsASidecarButNoPhotoAsASidecar(): void {
		$sidecar = $this->file(9, '/P/B.CR3.xmp', 'application/octet-stream');
		$photos = $this->photos($this->file(7, '/P/A.JPG'), $sidecar);
		$userFolder = $photos->userFolder($this->user());

		$this->assertSame($sidecar, $photos->sidecar($userFolder, 9));
		$this->assertNull($photos->sidecar($userFolder, 7));
	}

	public function testFindsPhotosAndSidecarsAsListedFilesButNoOtherFileOrFolder(): void {
		$jpeg = $this->file(7, '/P/A.JPG');
		$sidecar = $this->file(9, '/P/A.JPG.xmp', 'application/octet-stream');
		$folder = $this->folder('/P/Sub');
		$folder->method('getId')->willReturn(5);
		$photos = $this->photos($jpeg, $sidecar, $this->file(10, '/P/notes.txt', 'text/plain'), $folder);
		$userFolder = $photos->userFolder($this->user());

		$this->assertSame([$jpeg, $sidecar, null, null, null], array_map(static fn (int $id) => $photos->listed($userFolder, $id), [7, 9, 10, 5, 404]));
	}
}
