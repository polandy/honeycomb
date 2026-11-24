<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Service\VisualHash;

/** The visual hashes table, one row per file whoever saved it. */
final class VisualHashMapperTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private VisualHashMapper $hashes;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->hashes = new VisualHashMapper($this->db);
	}

	private static function row(int $fileId, string $etag = '', int $method = 1): VisualHash {
		$etag = $etag === '' ? "etag-$fileId" : $etag;
		return new VisualHash($fileId, $etag, $method, '00ff00ff00ff00ff');
	}

	/** @param list<int> $fileIds */
	private function save(array $fileIds): void {
		$this->hashes->replace(array_map(static fn (int $fileId): VisualHash => self::row($fileId), $fileIds));
	}

	public function testKeepsEveryFieldAndReplacesTheRowOfTheSameFile(): void {
		$this->save([7, 8]);
		$this->hashes->replace([self::row(7, 'etag-new', 2)]);

		$this->assertEquals([7 => self::row(7, 'etag-new', 2), 8 => self::row(8)], $this->hashes->find([7, 8, 9]));
	}

	public function testFindsAndReplacesMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->save(array_reverse($fileIds));
		$this->save($fileIds);

		$this->assertSame($fileIds, array_keys($this->hashes->find($fileIds)));
	}

	// spec: SERIES-003.15
	public function testCarriesTheRowOverWhoeverMovesTheFile(): void {
		$this->save([7]);
		$this->hashes->carryOver(7, 20);

		$this->assertEquals([20 => self::row(20, 'etag-7')], $this->hashes->find([7, 20]));
	}

	public function testPagesAndDeletesTheRowsByRowId(): void {
		$this->save([7, 8, 9]);
		$all = $this->hashes->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);
		$this->assertSame([$rowIds[1] => 8], $this->hashes->fileIdsAfter($rowIds[0], 1));

		$this->assertSame(2, $this->hashes->deleteRows([$rowIds[0], $rowIds[2]]));
		$this->assertSame([8], array_keys($this->hashes->find([7, 8, 9])));
	}

	// spec: SERIES-006.20
	public function testClearsEveryRow(): void {
		$this->save([7, 8]);

		$this->assertSame(2, $this->hashes->clearAll());
		$this->assertSame([], $this->hashes->find([7, 8]));
	}
}
