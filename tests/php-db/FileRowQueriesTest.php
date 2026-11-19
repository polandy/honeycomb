<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Service\VisualHash;

/** The shared `FileRowQueries` SQL, through the visual hash mapper. */
final class FileRowQueriesTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private VisualHashMapper $hashes;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->hashes = new VisualHashMapper($this->db);
	}

	/** @param list<int> $fileIds */
	private function hash(string $userId, array $fileIds): void {
		$this->hashes->replace($userId, array_map(static fn (int $fileId): VisualHash => new VisualHash($fileId, "etag-$fileId", '00ff00ff00ff00ff'), $fileIds));
	}

	/**
	 * @param list<int> $fileIds
	 * @return list<int>
	 */
	private function fileIds(string $userId, array $fileIds): array {
		return array_keys($this->hashes->find($userId, $fileIds));
	}

	public function testFindsAndReplacesTheRowsOfMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->hash('alice', array_reverse($fileIds));
		$this->hash('alice', $fileIds);
		$this->assertSame($fileIds, $this->fileIds('alice', $fileIds));
	}

	public function testReplacesOnlyTheUsersRows(): void {
		$this->hash('alice', [7]);
		$this->hash('bob', [7]);
		$this->hashes->replace('alice', [new VisualHash(7, 'etag-new', '0000000000000000')]);
		$this->assertSame('etag-new', $this->hashes->find('alice', [7])[7]->etag);
		$this->assertSame('etag-7', $this->hashes->find('bob', [7])[7]->etag);
	}

	public function testCarriesTheUsersRowOverToTheNewFileId(): void {
		$this->hash('alice', [7]);
		$this->hash('bob', [7]);
		$this->hashes->carryOver('alice', 7, 20);
		$this->assertSame([20], $this->fileIds('alice', [7, 20]));
		$this->assertSame([7], $this->fileIds('bob', [7, 20]));
	}

	public function testPagesTheFileIdsByRowId(): void {
		$this->hash('alice', [7, 8]);
		$this->hash('bob', [9]);
		$all = $this->hashes->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);
		$this->assertSame([$rowIds[1] => 8], $this->hashes->fileIdsAfter($rowIds[0], 1));
		$this->assertSame([], $this->hashes->fileIdsAfter($rowIds[2], 10));
	}

	public function testDeletesMoreRowsThanOneInListTakes(): void {
		$this->hash('alice', range(1, self::BEYOND_CHUNK));
		$this->hash('bob', [7]);
		$aliceRows = array_keys($this->hashes->fileIdsAfter(0, self::BEYOND_CHUNK));
		$this->assertSame(self::BEYOND_CHUNK, $this->hashes->deleteRows($aliceRows));
		$this->assertSame([7], $this->fileIds('bob', [7]));
		$this->assertSame([], $this->fileIds('alice', [7]));
	}

	public function testForgetsTheUserOnly(): void {
		$this->hash('alice', [7]);
		$this->hash('bob', [7]);
		$this->hashes->forgetUser('alice');
		$this->assertSame([], $this->fileIds('alice', [7]));
		$this->assertSame([7], $this->fileIds('bob', [7]));
	}
}
