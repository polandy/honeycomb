<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\QualityMapper;
use OCA\Honeycomb\Domain\QualityValue;

/** The quality values table, one row per file whoever saved it. */
final class QualityMapperTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private QualityMapper $quality;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->quality = new QualityMapper($this->db);
	}

	private static function row(int $fileId, string $etag = ''): QualityValue {
		$etag = $etag === '' ? "etag-$fileId" : $etag;
		return new QualityValue($fileId, $etag, 1, 812.5, 27);
	}

	/** @param list<int> $fileIds */
	private function save(array $fileIds): void {
		$this->quality->replace(array_map(static fn (int $fileId): QualityValue => self::row($fileId), $fileIds));
	}

	public function testKeepsEveryFieldAndReplacesTheRowOfTheSameFile(): void {
		$this->save([7, 8]);
		$this->quality->replace([self::row(7, 'etag-new')]);

		$this->assertEquals([7 => self::row(7, 'etag-new'), 8 => self::row(8)], $this->quality->find([7, 8, 9]));
	}

	public function testASaveUpdatesTheRowInPlaceAndInsertsTheNewOnes(): void {
		$this->save([7, 8]);
		$before = $this->rowIds('honeycomb_quality');
		$this->quality->replace([self::row(7, 'etag-new'), self::row(9)]);

		$after = $this->rowIds('honeycomb_quality');
		$this->assertSame($before[7], $after[7]);
		$this->assertSame($before[8], $after[8]);
		$this->assertSame([7, 8, 9], array_keys($after));
	}

	public function testFindsAndReplacesMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->save(array_reverse($fileIds));
		$this->save($fileIds);

		$this->assertSame($fileIds, array_keys($this->quality->find($fileIds)));
	}

	// spec: SERIES-006.14
	public function testCarriesTheRowOverWhoeverMovesTheFile(): void {
		$this->save([7]);
		$this->quality->carryOver(7, 20);

		$this->assertEquals([20 => self::row(20, 'etag-7')], $this->quality->find([7, 20]));
	}

	public function testPagesAndDeletesTheRowsByRowId(): void {
		$this->save([7, 8, 9]);
		$all = $this->quality->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);
		$this->assertSame([$rowIds[1] => 8], $this->quality->fileIdsAfter($rowIds[0], 1));

		$this->assertSame(2, $this->quality->deleteRows([$rowIds[0], $rowIds[2]]));
		$this->assertSame([8], array_keys($this->quality->find([7, 8, 9])));
	}

	// spec: SERIES-006.20
	public function testClearsEveryRow(): void {
		$this->save([7, 8]);

		$this->assertSame(2, $this->quality->clearAll());
		$this->assertSame([], $this->quality->find([7, 8]));
	}
}
