<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\FileCacheLookup;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IUserManager;
use OCP\Server;

/** The flags table and the file cache lookups the orphan clean-up uses. */
final class FlagMapperTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;
	private const string USER = 'honeycomb-flags';
	private const string PASSWORD = 'honeycomb-flags-Passw0rd-long!';

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

	private static function flag(int $fileId, Flag $flag = Flag::Picked, bool $keepRaw = false, int $updatedAt = 100): FileFlag {
		return new FileFlag($fileId, $flag, $keepRaw, $updatedAt);
	}

	// spec: DECISIONS-001.23
	public function testSavesWholeStatesOverTheEarlierRows(): void {
		$this->flags->save([self::flag(7, Flag::Rejected, true), self::flag(8)]);
		$this->flags->save([self::flag(7, Flag::Unflagged, false, 200)]);

		$this->assertEquals([7 => self::flag(7, Flag::Unflagged, false, 200), 8 => self::flag(8)], $this->flags->find([7, 8, 9]));
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

	// spec: DECISIONS-001.32
	public function testAFileInTheTrashBinIsNotOutsideItUntilItIsRestored(): void {
		$home = Server::get(IRootFolder::class)->getUserFolder(self::USER);
		$kept = $home->newFolder('Photos')->newFile('a.jpg', 'x');
		$trashed = $home->get('Photos')->newFile('b.jpg', 'x');
		assert($trashed instanceof File);
		$trashBin = Server::get(IRootFolder::class)->get('/' . self::USER)->newFolder('files_trashbin/files');
		assert($trashBin instanceof Folder);
		$lookup = new FileCacheLookup($this->db);
		$gone = PHP_INT_MAX;

		$trashed = $trashed->move($trashBin->getPath() . '/b.jpg.d1800000000');
		$this->assertSame([$kept->getId()], $lookup->outsideTrashBin([$kept->getId(), $trashed->getId(), $gone]));
		$this->assertEqualsCanonicalizing([$kept->getId(), $trashed->getId()], $lookup->existing([$kept->getId(), $trashed->getId(), $gone]));

		$trashed->move($home->getPath() . '/Photos/b.jpg');
		$this->assertEqualsCanonicalizing([$kept->getId(), $trashed->getId()], $lookup->outsideTrashBin([$kept->getId(), $trashed->getId(), $gone]));
	}
}
