<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\TagMapper;
use OCA\Honeycomb\Service\PictureTags;

/** The shared `FileRowQueries` SQL, through the tag mapper. */
final class FileRowQueriesTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private TagMapper $tags;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->tags = new TagMapper($this->db);
	}

	/** @param list<int> $fileIds */
	private function tag(string $userId, array $fileIds): void {
		$this->tags->replace($userId, $fileIds, array_map(static fn (int $fileId): PictureTags => new PictureTags($fileId, ['Anna']), $fileIds));
	}

	/**
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	private function fileIds(string $userId, array $fileIds): array {
		return array_map(static fn (PictureTags $picture): int => $picture->fileId, $this->tags->find($userId, $fileIds));
	}

	public function testFindsAndReplacesTheRowsOfMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->tag('alice', array_reverse($fileIds));
		$this->assertSame($fileIds, $this->fileIds('alice', $fileIds));
		$this->tags->replace('alice', $fileIds, []);
		$this->assertSame([], $this->fileIds('alice', $fileIds));
	}

	public function testReplacesOnlyTheUsersRows(): void {
		$this->tag('alice', [7]);
		$this->tag('bob', [7]);
		$this->tags->replace('alice', [7], []);
		$this->assertSame([], $this->fileIds('alice', [7]));
		$this->assertSame([7], $this->fileIds('bob', [7]));
	}

	public function testCarriesTheUsersRowOverToTheNewFileId(): void {
		$this->tag('alice', [7]);
		$this->tag('bob', [7]);
		$this->tags->carryOver('alice', 7, 20);
		$this->assertSame([20], $this->fileIds('alice', [7, 20]));
		$this->assertSame([7], $this->fileIds('bob', [7, 20]));
	}

	public function testPagesTheFileIdsByRowId(): void {
		$this->tag('alice', [7, 8]);
		$this->tag('bob', [9]);
		$all = $this->tags->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);
		$this->assertSame([$rowIds[1] => 8], $this->tags->fileIdsAfter($rowIds[0], 1));
		$this->assertSame([], $this->tags->fileIdsAfter($rowIds[2], 10));
	}

	public function testDeletesMoreRowsThanOneInListTakes(): void {
		$this->tag('alice', range(1, self::BEYOND_CHUNK));
		$this->tag('bob', [7]);
		$aliceRows = array_keys($this->tags->fileIdsAfter(0, self::BEYOND_CHUNK));
		$this->assertSame(self::BEYOND_CHUNK, $this->tags->deleteRows($aliceRows));
		$this->assertSame([7], $this->fileIds('bob', [7]));
		$this->assertSame([], $this->fileIds('alice', [7]));
	}

	public function testForgetsTheUserOnly(): void {
		$this->tag('alice', [7]);
		$this->tag('bob', [7]);
		$this->tags->forgetUser('alice');
		$this->assertSame([], $this->fileIds('alice', [7]));
		$this->assertSame([], $this->tags->tagList('alice'));
		$this->assertSame(['Anna'], $this->tags->tagList('bob'));
	}
}
