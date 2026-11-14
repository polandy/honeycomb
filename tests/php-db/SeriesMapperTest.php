<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Service\SeriesLookup;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\SeriesWrite;
use OCA\Honeycomb\Service\StoredSeries;

/**
 * The series SQL against a real database.
 * @psalm-suppress PossiblyUndefinedArrayOffset The tests destructure the ids a write returns, one per series item.
 */
final class SeriesMapperTest extends DbTestCase {
	/** More file ids than one `IN` list takes. */
	private const int BEYOND_CHUNK = 2_500;

	private SeriesMapper $series;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->series = new SeriesMapper($this->db);
	}

	/**
	 * Writes the series items, each `[id, status, ...fileIds]`, and returns their ids.
	 * @param list<array<int|string|null>> $items
	 * @param list<int> $keptOut
	 * @param list<int> $released
	 * @return list<int>
	 */
	private function write(string $userId, array $items, array $keptOut = [], array $released = []): array {
		$series = array_map(static fn (array $item): array => ['id' => $item[0], 'status' => $item[1], 'fileIds' => array_slice($item, 2)], $items);
		return $this->series->write($userId, SeriesWrite::fromRequest($series, $keptOut, $released));
	}

	/** @param list<int> $fileIds */
	private function find(string $userId, array $fileIds): SeriesLookup {
		return $this->series->find($userId, $fileIds);
	}

	// spec: SERIES-005.20, SERIES-005.21
	public function testFindsTheWrittenSeriesAndKeptOutFiles(): void {
		[$first, $second] = $this->write('alice', [[null, 'done', 8, 7], [null, 'open', 3]], [9]);
		$lookup = $this->find('alice', [3, 7, 8, 9, 10]);
		$this->assertEquals([new StoredSeries($first, SeriesStatus::Done, [7, 8], false), new StoredSeries($second, SeriesStatus::Open, [3], false)], $lookup->series);
		$this->assertSame([9], $lookup->keptOut);
		$this->assertEquals(new SeriesLookup([], []), $this->find('bob', [3, 7, 8, 9]));
	}

	// spec: SERIES-005.20
	public function testTellsASeriesWithMembersOutsideTheFileIds(): void {
		[$id] = $this->write('alice', [[null, 'open', 7, 8]]);
		$this->assertEquals([new StoredSeries($id, SeriesStatus::Open, [7], true)], $this->find('alice', [7])->series);
	}

	// spec: SERIES-005.21
	public function testKeepsTheUnlistedMembersAndMovesAndReleasesTheListedOnes(): void {
		[$first, $second] = $this->write('alice', [[null, 'open', 7, 8, 9], [null, 'open', 3]], [4]);
		$this->assertSame([$first, $second], $this->write('alice', [[$first, 'done'], [$second, 'open', 8]], [9], [4, 3]));
		$lookup = $this->find('alice', [3, 4, 7, 8, 9]);
		$this->assertEquals([new StoredSeries($first, SeriesStatus::Done, [7], false), new StoredSeries($second, SeriesStatus::Open, [8], false)], $lookup->series);
		$this->assertSame([9], $lookup->keptOut);
	}

	// spec: SERIES-005.22
	public function testMakesANewSeriesForAnIdOfAnotherUserOrOneThatVanished(): void {
		[$alices] = $this->write('alice', [[null, 'done', 7]]);
		[$bobs] = $this->write('bob', [[$alices, 'open', 7]]);
		[$again] = $this->write('alice', [[$alices + 1000, 'open', 8]]);
		$this->assertNotSame($alices, $bobs);
		$this->assertNotContains($again, [$alices, $bobs]);
		$this->assertEquals([new StoredSeries($alices, SeriesStatus::Done, [7], false), new StoredSeries($again, SeriesStatus::Open, [8], false)], $this->find('alice', [7, 8])->series);
		$this->assertEquals([new StoredSeries($bobs, SeriesStatus::Open, [7], false)], $this->find('bob', [7, 8])->series);
	}

	public function testReadsAMemberWhoseSeriesRowIsGoneAsOpen(): void {
		[$id] = $this->write('alice', [[null, 'done', 7]]);
		$this->db->getQueryBuilder()->delete('honeycomb_series')->executeStatement();
		$this->assertEquals([new StoredSeries($id, SeriesStatus::Open, [7], false)], $this->find('alice', [7])->series);
	}

	// spec: SERIES-005.20, SERIES-005.21
	public function testWritesAndFindsMoreFileIdsThanOneInListTakes(): void {
		$fileIds = range(1, self::BEYOND_CHUNK);
		[$id] = $this->write('alice', [[null, 'open', ...$fileIds]]);
		$this->assertEquals([new StoredSeries($id, SeriesStatus::Open, $fileIds, false)], $this->find('alice', $fileIds)->series);
		$this->write('alice', [], [], $fileIds);
		$this->assertEquals(new SeriesLookup([], []), $this->find('alice', $fileIds));
	}

	// spec: SERIES-005.25
	public function testCarriesAMemberAndAKeptOutFileOverToTheirNewFileIds(): void {
		[$id] = $this->write('alice', [[null, 'open', 7, 8]], [9]);
		$this->series->carryOver('alice', 7, 20);
		$this->series->carryOver('alice', 9, 30);
		$lookup = $this->find('alice', [7, 8, 9, 20, 30]);
		$this->assertEquals([new StoredSeries($id, SeriesStatus::Open, [8, 20], false)], $lookup->series);
		$this->assertSame([30], $lookup->keptOut);
	}

	// spec: SERIES-005.25
	public function testForgetsBothTablesOfTheUserOnly(): void {
		[$alices] = $this->write('alice', [[null, 'open', 7], [null, 'open']], [9]);
		[$bobs] = $this->write('bob', [[null, 'open', 7]]);
		$this->series->forgetUser('alice');
		$this->assertEquals(new SeriesLookup([], []), $this->find('alice', [7, 9]));
		$this->assertSame([$bobs], $this->series->seriesIdsAfter(0, 10));
		$this->assertNotSame($alices, $bobs);
	}

	// spec: SERIES-005.25
	public function testRemovesOnlyTheSeriesWithoutAFileRowAmongMoreIdsThanOneInListTakes(): void {
		$empty = [];
		foreach ([1_000, 1_000, 500] as $count) {
			array_push($empty, ...$this->write('alice', array_fill(0, $count, [null, 'open'])));
		}
		[$lone] = $this->write('bob', [[null, 'done', 7]]);
		$all = $this->series->seriesIdsAfter(0, self::BEYOND_CHUNK + 1);
		$this->assertSame([...$empty, $lone], $all);
		$this->assertSame([$empty[1]], $this->series->seriesIdsAfter($empty[0], 1));
		$this->assertSame(self::BEYOND_CHUNK, $this->series->deleteEmptySeries($all));
		$this->assertSame([$lone], $this->series->seriesIdsAfter(0, 10));
	}

	// spec: SERIES-005.25
	public function testPagesTheMemberRowsAndDeletesThemByRowId(): void {
		$this->write('alice', [[null, 'open', 7, 8]], [9]);
		$rows = $this->series->fileIdsAfter(0, 10);
		$this->assertEqualsCanonicalizing([7, 8, 9], array_values($rows));
		$this->assertSame(1, $this->series->deleteRows([(int)array_search(7, $rows, true)]));
		$this->assertSame([8], $this->find('alice', [7, 8])->series[0]->fileIds);
	}
}
