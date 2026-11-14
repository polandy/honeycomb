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
		$folder = $this->folder('');
		$folder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $byId[$id] ?? null);
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
}
