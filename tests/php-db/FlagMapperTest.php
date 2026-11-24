<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\FileCacheLookup;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IUserManager;
use OCP\Server;

/** The flags table and the file cache lookups the orphan clean-up uses. */
final class FlagMapperTest extends DbTestCase {
	use ProbesWriteLock;

	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;
	private const string USER = 'honeycomb-flags';
	private const string PASSWORD = 'honeycomb-flags-Passw0rd-long!';
	private const string ASSET = '3f2a9c1e-0b7d-4e5a-9f61-2c8d4b7a1e90';

	private FlagMapper $flags;
	private IUserManager $users;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->flags = new FlagMapper($this->db);
		$this->users = Server::get(IUserManager::class);
		$this->users->get(self::USER)?->delete();
		$this->users->createUser(self::USER, self::PASSWORD);
	}

	#[\Override]
	protected function tearDown(): void {
		$this->users->get(self::USER)?->delete();
		parent::tearDown();
	}

	private static function flag(int $fileId, Flag $flag = Flag::Picked, bool $keepRaw = false, int $updatedAt = 100, ?string $updatedBy = null): FileFlag {
		return new FileFlag($fileId, $flag, $keepRaw, $updatedAt, $updatedBy);
	}

	// spec: DECISIONS-001.23
	public function testSavesWholeStatesOverTheEarlierRows(): void {
		$this->flags->save([self::flag(7, Flag::Rejected, true), self::flag(8)]);
		$this->flags->save([self::flag(7, Flag::Unflagged, false, 200)]);

		$this->assertEquals([7 => self::flag(7, Flag::Unflagged, false, 200), 8 => self::flag(8)], $this->flags->find([7, 8, 9]));
	}

	// spec: DELETE-001.15
	public function testRemovesTheRowsOfTheFileIdsGiven(): void {
		$this->flags->save([self::flag(7), self::flag(8), self::flag(9)]);
		$this->flags->remove([7, 9, 10]);

		$this->assertEquals([8 => self::flag(8)], $this->flags->find([7, 8, 9]));
	}

	public function testFindsAndSavesMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		$this->flags->save(array_map(static fn (int $id): FileFlag => self::flag($id), array_reverse($fileIds)));
		$this->flags->save(array_map(static fn (int $id): FileFlag => self::flag($id, Flag::Rejected), $fileIds));

		$found = $this->flags->find($fileIds);
		$this->assertSame($fileIds, array_keys($found));
		$this->assertSame([Flag::Rejected], array_values(array_unique(array_map(static fn (FileFlag $flag): Flag => $flag->flag, $found), SORT_REGULAR)));
	}

	// spec: DECISIONS-001.27
	public function testTakesOverOnlyWhereNoRowIsAndAnswersTheInsertedIds(): void {
		$this->flags->save([self::flag(7, Flag::Rejected)]);

		$this->assertSame([8], $this->flags->takeOver([self::flag(7, Flag::Picked, true, 200), self::flag(8, Flag::Unflagged, false, 200)]));
		$this->assertEquals([7 => self::flag(7, Flag::Rejected), 8 => self::flag(8, Flag::Unflagged, false, 200)], $this->flags->find([7, 8]));
	}

	// spec: DECISIONS-001.34
	public function testATakeOverTakesTheWriteLockWithTheFirstStatementOfItsTransaction(): void {
		$this->requireSqlite();
		$this->flags->save([self::flag(7, Flag::Rejected)]);

		$inserted = (new FlagMapper($this->probedConnection()))->takeOver([self::flag(7), self::flag(8)]);

		$this->assertTrue($this->lockedAfterFirstStatement);
		$this->assertSame([8], $inserted);
	}

	// spec: MOVE-002.10
	public function testCarriesTheRowOverWhoeverSetIt(): void {
		$this->flags->save([self::flag(7)]);

		$this->flags->carryOver('someone-else', 7, 20);

		$this->assertEquals([20 => self::flag(20)], $this->flags->find([7, 20]));
	}

	public function testPagesAndDeletesTheRowsByRowId(): void {
		$this->flags->save([self::flag(7), self::flag(8), self::flag(9)]);
		$all = $this->flags->fileIdsAfter(0, 10);
		$this->assertSame([7, 8, 9], array_values($all));

		$this->assertSame(1, $this->flags->deleteRows([array_key_first($all)]));
		$this->assertSame([8, 9], array_keys($this->flags->find([7, 8, 9])));
	}

	// spec: DECISIONS-001.36
	public function testLeavesTheRowsOfAnotherSourceAlone(): void {
		$this->insertImmichRow();
		$this->flags->save([self::flag(7), self::flag(8)]);
		$this->flags->takeOver([self::flag(9)]);
		$this->flags->remove([8]);
		$this->flags->carryOver(self::USER, 9, 10);

		$this->assertEquals([7 => self::flag(7), 10 => self::flag(10)], $this->flags->find([0, 7, 8, 9, 10]));
		$this->assertSame([7, 10], array_values($this->flags->fileIdsAfter(0, 10)));
		$this->assertSame([['immich', null, self::ASSET, 'rejected'], ['file', 7, null, 'picked'], ['file', 10, null, 'picked']], $this->sourceRows());
	}

	// spec: DECISIONS-001.37, DECISIONS-001.36
	public function testNotesWhoDecidedLastAndEmptiesItForADeletedUser(): void {
		$this->insertImmichRow();
		$this->flags->save([self::flag(7, updatedBy: 'anna'), self::flag(8, updatedBy: 'anna')]);
		$this->flags->takeOver([self::flag(9, updatedBy: 'ben')]);
		$this->flags->save([self::flag(8, Flag::Rejected, updatedBy: 'ben')]);

		$this->flags->forgetUser('anna');
		$this->flags->forgetUser(self::USER);

		$this->assertEquals([7 => self::flag(7), 8 => self::flag(8, Flag::Rejected, updatedBy: 'ben'), 9 => self::flag(9, updatedBy: 'ben')], $this->flags->find([7, 8, 9]));
		$query = $this->db->getQueryBuilder();
		$result = $query->select('updated_by')->from('honeycomb_decisions')->where($query->expr()->eq('source', $query->createNamedParameter('immich')))->executeQuery();
		$this->assertSame(self::USER, $result->fetchOne());
		$result->closeCursor();
	}

	/** An Immich decision row as ADR 0054 shapes it. */
	private function insertImmichRow(): void {
		$query = $this->db->getQueryBuilder();
		$query->insert('honeycomb_decisions')->values([
			'source' => $query->createNamedParameter('immich'),
			'connection_id' => $query->createNamedParameter('home'),
			'asset_id' => $query->createNamedParameter(self::ASSET),
			'user_id' => $query->createNamedParameter(self::USER),
			'updated_by' => $query->createNamedParameter(self::USER),
			'flag' => $query->createNamedParameter('rejected'),
			'keep_raw' => $query->createNamedParameter(false, IQueryBuilder::PARAM_BOOL),
			'rating' => $query->createNamedParameter(3, IQueryBuilder::PARAM_INT),
			'colour_label' => $query->createNamedParameter('red'),
			'updated_at' => $query->createNamedParameter(100, IQueryBuilder::PARAM_INT),
		])->executeStatement();
	}

	/** @return list<array{string, ?int, ?string, string}> source, file id, asset id and flag of every row, in row id order */
	private function sourceRows(): array {
		$query = $this->db->getQueryBuilder();
		$result = $query->select('source', 'file_id', 'asset_id', 'flag')->from('honeycomb_decisions')->orderBy('id')->executeQuery();
		$rows = [];
		while (($row = $result->fetch()) !== false) {
			$rows[] = [(string)$row['source'], $row['file_id'] === null ? null : (int)$row['file_id'], $row['asset_id'] === null ? null : (string)$row['asset_id'], (string)$row['flag']];
		}
		$result->closeCursor();
		return $rows;
	}

	// spec: DECISIONS-001.32
	public function testAFileInTheTrashBinIsNotOutsideItUntilItIsRestored(): void {
		$home = Server::get(IRootFolder::class)->getUserFolder(self::USER);
		$photos = $home->newFolder('Photos');
		$kept = $photos->newFile('a.jpg', 'x');
		$trashed = $photos->newFile('b.jpg', 'x');
		$userRoot = Server::get(IRootFolder::class)->get('/' . self::USER);
		assert($userRoot instanceof Folder);
		$trashBin = $userRoot->newFolder('files_trashbin/files');
		$lookup = new FileCacheLookup($this->db);
		$gone = PHP_INT_MAX;

		$trashed = $trashed->move($trashBin->getPath() . '/b.jpg.d1800000000');
		$this->assertSame([$kept->getId()], $lookup->outsideTrashBin([$kept->getId(), $trashed->getId(), $gone]));
		$this->assertEqualsCanonicalizing([$kept->getId(), $trashed->getId()], $lookup->existing([$kept->getId(), $trashed->getId(), $gone]));

		$trashed->move($home->getPath() . '/Photos/b.jpg');
		$this->assertEqualsCanonicalizing([$kept->getId(), $trashed->getId()], $lookup->outsideTrashBin([$kept->getId(), $trashed->getId(), $gone]));
	}
}
