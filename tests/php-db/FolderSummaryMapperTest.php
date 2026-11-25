<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\FolderSummaryMapper;
use OCA\Honeycomb\Domain\FolderSummary;
use OCP\DB\QueryBuilder\IQueryBuilder;

/** The folder summaries table, one row per folder whoever scanned it. */
final class FolderSummaryMapperTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private FolderSummaryMapper $summaries;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->summaries = new FolderSummaryMapper($this->db);
	}

	private const array PREVIEWS = [['fileId' => 1_234_567_890, 'mtime' => 1_700_000_001], ['fileId' => 5, 'mtime' => 1_700_000_002], ['fileId' => 99, 'mtime' => 3]];

	private static function row(int $fileId, string $etag = ''): FolderSummary {
		return new FolderSummary($fileId, $etag === '' ? "etag-$fileId" : $etag, 600, 30_000_000_000, 25_000_000_000, 12, 1_600_000_000, 1_600_000_900, 1_700_000_000, 1_800_000_000, self::PREVIEWS);
	}

	// spec: FOLDERS-005.1, FOLDERS-005.2, FOLDERS-005.4
	public function testKeepsEveryFieldAndReplacesTheRowOfTheSameFolder(): void {
		$empty = new FolderSummary(8, 'etag-8', 0, 0, 0, 0, null, null, null, 5);
		$this->summaries->replace([self::row(7), $empty]);
		$this->summaries->replace([self::row(7, 'etag-new')]);

		$this->assertEquals([7 => self::row(7, 'etag-new'), 8 => $empty], $this->summaries->find([7, 8, 9]));
	}

	// spec: FOLDERS-005.18
	public function testAFolderWithoutPreviewsComesBackEmptyAndACorruptValueFailsLoud(): void {
		$this->summaries->replace([new FolderSummary(7, 'etag-7', 0, 0, 0, 0, null, null, null, 5), self::row(8)]);
		$this->assertSame([], $this->summaries->find([7])[7]->previews);

		$update = $this->db->getQueryBuilder();
		$update->update('honeycomb_folder_summary')
			->set('previews', $update->createNamedParameter('12:x'))
			->where($update->expr()->eq('file_id', $update->createNamedParameter(8, IQueryBuilder::PARAM_INT)))
			->executeStatement();

		$this->expectException(\UnexpectedValueException::class);
		$this->expectExceptionMessage('Malformed folder previews: 12:x');
		$this->summaries->find([8]);
	}

	public function testFindsAndReplacesMoreFoldersThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->summaries->replace(array_map(static fn (int $fileId): FolderSummary => self::row($fileId), $fileIds));
		$this->summaries->replace(array_map(static fn (int $fileId): FolderSummary => self::row($fileId), array_reverse($fileIds)));

		$found = $this->summaries->find($fileIds);
		ksort($found);
		$this->assertSame($fileIds, array_keys($found));
	}

	public function testCarriesTheRowOverWhoeverMovesTheFolder(): void {
		$this->summaries->replace([self::row(7)]);
		$this->summaries->carryOver(7, 20);

		$this->assertEquals([20 => new FolderSummary(20, 'etag-7', 600, 30_000_000_000, 25_000_000_000, 12, 1_600_000_000, 1_600_000_900, 1_700_000_000, 1_800_000_000, self::PREVIEWS)], $this->summaries->find([7, 20]));
	}

	// spec: FOLDERS-005.17
	public function testPagesAndDeletesTheRowsByRowId(): void {
		$this->summaries->replace([self::row(7), self::row(8), self::row(9)]);
		$all = $this->summaries->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);
		$this->assertSame([$rowIds[1] => 8], $this->summaries->fileIdsAfter($rowIds[0], 1));

		$this->assertSame(2, $this->summaries->deleteRows([$rowIds[0], $rowIds[2]]));
		$this->assertSame([8], array_keys($this->summaries->find([7, 8, 9])));
	}
}
