<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\AtomicFileRowCarryOver;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Db\FolderDoneMapper;
use OCA\Honeycomb\Db\FolderSummaryMapper;
use OCA\Honeycomb\Db\QualityMapper;
use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\SeriesWrite;
use OCA\Honeycomb\Domain\Store\FileRowStores;
use OCA\Honeycomb\Domain\Store\XmpCacheStore;
use OCA\Honeycomb\Domain\XmpCacheRow;
use OCA\Honeycomb\Domain\XmpReadState;
use OCA\Honeycomb\Domain\XmpSource;
use OCP\DB\Exception as DbException;

/** The carry-over of a moved file's rows across every store, in a shared folder, against a real database. */
final class AtomicFileRowCarryOverTest extends DbTestCase {
	private const array USERS = ['alice', 'bob'];

	private FlagMapper $flags;
	private SeriesMapper $series;
	private XmpCacheMapper $xmpCache;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->flags = new FlagMapper($this->db);
		$this->series = new SeriesMapper($this->db);
		$this->xmpCache = new XmpCacheMapper($this->db);
		$this->flags->save([new FileFlag(7, Flag::Picked, false, 100)]);
		foreach (self::USERS as $userId) {
			$this->series->write($userId, SeriesWrite::fromRequest([['id' => null, 'status' => 'open', 'fileIds' => [7, 8]]], [], []));
			$this->xmpCache->replace($userId, [new XmpCacheRow(7, XmpSource::Embedded, 'etag-7', 1, XmpReadState::Refused, null, null, null, null, null, null)]);
		}
	}

	private function carryOver(?XmpCacheStore $xmpCache = null): AtomicFileRowCarryOver {
		$stores = new FileRowStores($this->flags, new VisualHashMapper($this->db), $this->series, $xmpCache ?? $this->xmpCache, new QualityMapper($this->db), new FolderSummaryMapper($this->db), new FolderDoneMapper($this->db));
		return new AtomicFileRowCarryOver($this->db, $stores);
	}

	/** @return array{flags: list<int>, alice: array{series: list<int>, xmpCache: list<int>}, bob: array{series: list<int>, xmpCache: list<int>}} the file ids each store holds of 7 and 20 */
	private function fileIds(): array {
		$fileIds = ['flags' => array_keys($this->flags->find([7, 20]))];
		foreach (self::USERS as $userId) {
			$members = $this->series->find($userId, [7, 20])->series[0]->fileIds ?? [];
			$fileIds[$userId] = ['series' => array_values(array_intersect($members, [7, 20])), 'xmpCache' => array_keys($this->xmpCache->find($userId, [7, 20]))];
		}
		return $fileIds;
	}

	/** @return array{flags: list<int>, alice: array{series: list<int>, xmpCache: list<int>}, bob: array{series: list<int>, xmpCache: list<int>}} */
	private static function allUnder(int $fileId): array {
		$user = ['series' => [$fileId], 'xmpCache' => [$fileId]];
		return ['flags' => [$fileId], 'alice' => $user, 'bob' => $user];
	}

	// spec: MOVE-002.10
	public function testCarriesEveryUsersRowsOverToTheNewFileId(): void {
		$this->carryOver()->carryOver(7, 20);

		$this->assertSame(self::allUnder(20), $this->fileIds());
	}

	// spec: MOVE-002.10
	public function testAFailureMidwayLeavesEveryRowUnderTheOldFileId(): void {
		$failure = new DbException('connection lost');
		$xmpCache = $this->createStub(XmpCacheStore::class);
		$xmpCache->method('carryOver')->willThrowException($failure);

		try {
			$this->carryOver($xmpCache)->carryOver(7, 20);
			$this->fail('The failure was swallowed');
		} catch (DbException $e) {
			$this->assertSame($failure, $e);
		}

		$this->assertSame(self::allUnder(7), $this->fileIds());
		$this->assertFalse($this->db->inTransaction());
	}
}
