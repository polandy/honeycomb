<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpReadState;
use OCA\Honeycomb\Service\XmpSource;

/** The shared `FileRowQueries` SQL, through the XMP cache mapper, whose rows are per user. */
final class FileRowQueriesTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private XmpCacheMapper $cache;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->cache = new XmpCacheMapper($this->db);
	}

	/** @param list<int> $fileIds */
	private function cached(string $userId, array $fileIds): void {
		$this->cache->replace($userId, array_map(static fn (int $fileId): XmpCacheRow => self::row($fileId, "etag-$fileId"), $fileIds));
	}

	private static function row(int $fileId, string $etag): XmpCacheRow {
		return new XmpCacheRow($fileId, XmpSource::Embedded, $etag, 1, XmpReadState::Refused, null, null, null, null, null, null);
	}

	/**
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	private function fileIds(string $userId, array $fileIds): array {
		return array_keys($this->cache->find($userId, $fileIds));
	}

	public function testFindsAndReplacesTheRowsOfMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->cached('alice', array_reverse($fileIds));
		$this->cached('alice', $fileIds);
		$this->assertSame($fileIds, $this->fileIds('alice', $fileIds));
	}

	public function testReplacesOnlyTheUsersRows(): void {
		$this->cached('alice', [7]);
		$this->cached('bob', [7]);
		$this->cache->replace('alice', [self::row(7, 'etag-new')]);
		$this->assertSame('etag-new', $this->cache->find('alice', [7])[7]->etag);
		$this->assertSame('etag-7', $this->cache->find('bob', [7])[7]->etag);
	}

	public function testCarriesTheUsersRowOverToTheNewFileId(): void {
		$this->cached('alice', [7]);
		$this->cached('bob', [7]);
		$this->cache->carryOver('alice', 7, 20);
		$this->assertSame([20], $this->fileIds('alice', [7, 20]));
		$this->assertSame([7], $this->fileIds('bob', [7, 20]));
	}

	public function testPagesTheFileIdsByRowId(): void {
		$this->cached('alice', [7, 8]);
		$this->cached('bob', [9]);
		$all = $this->cache->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);
		$this->assertSame([$rowIds[1] => 8], $this->cache->fileIdsAfter($rowIds[0], 1));
		$this->assertSame([], $this->cache->fileIdsAfter($rowIds[2], 10));
	}

	public function testDeletesMoreRowsThanOneInListTakes(): void {
		$this->cached('alice', range(1, self::BEYOND_CHUNK));
		$this->cached('bob', [7]);
		$aliceRows = array_keys($this->cache->fileIdsAfter(0, self::BEYOND_CHUNK));
		$this->assertSame(self::BEYOND_CHUNK, $this->cache->deleteRows($aliceRows));
		$this->assertSame([7], $this->fileIds('bob', [7]));
		$this->assertSame([], $this->fileIds('alice', [7]));
	}

	public function testForgetsTheUserOnly(): void {
		$this->cached('alice', [7]);
		$this->cached('bob', [7]);
		$this->cache->forgetUser('alice');
		$this->assertSame([], $this->fileIds('alice', [7]));
		$this->assertSame([7], $this->fileIds('bob', [7]));
	}
}
