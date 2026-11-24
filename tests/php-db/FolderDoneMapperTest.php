<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\FolderDoneMapper;
use OCA\Honeycomb\Domain\FolderDone;
use OCP\DB\QueryBuilder\IQueryBuilder;

/** The done statuses table, one row per folder. */
final class FolderDoneMapperTest extends DbTestCase {
	private FolderDoneMapper $done;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->done = new FolderDoneMapper($this->db);
	}

	private function insert(FolderDone $row): void {
		$insert = $this->db->getQueryBuilder();
		$insert->insert('honeycomb_folder_done')->values([
			'file_id' => $insert->createNamedParameter($row->fileId, IQueryBuilder::PARAM_INT),
			'user_id' => $insert->createNamedParameter($row->userId),
			'done_at' => $insert->createNamedParameter($row->doneAt, IQueryBuilder::PARAM_INT),
			'photos' => $insert->createNamedParameter($row->photos, IQueryBuilder::PARAM_INT),
		])->executeStatement();
	}

	// spec: FOLDERS-005.10
	public function testFindsTheDoneStatusOfTheFoldersGiven(): void {
		$this->insert(new FolderDone(7, 'bob', 1_750_000_000, 412));
		$this->insert(new FolderDone(8, 'alice', 1_760_000_000, 3));

		$this->assertEquals([7 => new FolderDone(7, 'bob', 1_750_000_000, 412)], $this->done->find([7, 9]));
	}

	public function testCarriesTheRowOverWhoeverMovesTheFolder(): void {
		$this->insert(new FolderDone(7, 'bob', 1_750_000_000, 412));
		$this->done->carryOver(7, 20);

		$this->assertEquals([20 => new FolderDone(20, 'bob', 1_750_000_000, 412)], $this->done->find([7, 20]));
	}

	// spec: FOLDERS-006.13
	public function testForgetsTheNameOfOneUserAndKeepsEveryStatus(): void {
		$this->insert(new FolderDone(7, 'alice', 10, 3));
		$this->insert(new FolderDone(8, 'bob', 20, 4));
		$this->insert(new FolderDone(9, 'alice', 30, 5));

		$this->done->forgetUser('alice');

		$this->assertEquals([
			7 => new FolderDone(7, null, 10, 3),
			8 => new FolderDone(8, 'bob', 20, 4),
			9 => new FolderDone(9, null, 30, 5),
		], $this->done->find([7, 8, 9]));
	}

	// spec: FOLDERS-006.13
	public function testForgettingAUserWithoutStatusesChangesNothing(): void {
		$this->insert(new FolderDone(8, 'bob', 20, 4));

		$this->done->forgetUser('alice');
		$this->done->forgetUser('alice');

		$this->assertEquals([8 => new FolderDone(8, 'bob', 20, 4)], $this->done->find([8]));
	}

	// spec: FOLDERS-006.14
	public function testReadsAStatusWithoutANameAndReplacesItByAnotherUsersStatus(): void {
		$this->insert(new FolderDone(7, null, 10, 3));
		$this->assertEquals([7 => new FolderDone(7, null, 10, 3)], $this->done->find([7]));

		$this->done->put(new FolderDone(7, 'bob', 40, 6));

		$this->assertEquals([7 => new FolderDone(7, 'bob', 40, 6)], $this->done->find([7]));
	}

	// spec: FOLDERS-005.17
	public function testPagesAndDeletesTheRowsByRowId(): void {
		foreach ([7, 8, 9] as $fileId) {
			$this->insert(new FolderDone($fileId, 'bob', 1, 1));
		}
		$all = $this->done->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));
		$rowIds = array_keys($all);

		$this->assertSame(2, $this->done->deleteRows([$rowIds[0], $rowIds[2]]));
		$this->assertSame([8], array_keys($this->done->find([7, 8, 9])));
	}

	// spec: FOLDERS-006.2
	public function testPutReplacesTheFoldersStatus(): void {
		$this->done->put(new FolderDone(7, 'bob', 1_750_000_000, 400));
		$this->done->put(new FolderDone(7, 'alice', 1_760_000_000, 412));
		$this->done->put(new FolderDone(8, 'bob', 1, 1));

		$this->assertEquals([7 => new FolderDone(7, 'alice', 1_760_000_000, 412), 8 => new FolderDone(8, 'bob', 1, 1)], $this->done->find([7, 8]));
	}

	// spec: FOLDERS-006.3
	public function testRemoveDropsOnlyThatFoldersStatusAndIsNoErrorWithoutOne(): void {
		$this->done->put(new FolderDone(7, 'bob', 1, 1));
		$this->done->put(new FolderDone(8, 'bob', 1, 1));

		$this->done->remove(7);
		$this->done->remove(7);

		$this->assertSame([8], array_keys($this->done->find([7, 8])));
	}
}
