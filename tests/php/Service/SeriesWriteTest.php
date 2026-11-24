<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\SeriesWrite;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SeriesWriteTest extends TestCase {
	private const int FILE_LIMIT = 60_000;
	private const int SERIES_LIMIT = 1_000;

	// spec: SERIES-005.21
	public function testReadsEverySeriesItemAndBothListsInRequestOrder(): void {
		$write = SeriesWrite::fromRequest(
			[['id' => 12, 'status' => 'done', 'fileIds' => [9, 7]], ['id' => null, 'status' => 'open', 'fileIds' => []]],
			[5],
			[3, 4],
		);
		$this->assertSame([12, null], array_map(static fn ($item): ?int => $item->id, $write->series));
		$this->assertSame([SeriesStatus::Done, SeriesStatus::Open], array_map(static fn ($item): SeriesStatus => $item->status, $write->series));
		$this->assertSame([[9, 7], []], array_map(static fn ($item): array => $item->fileIds, $write->series));
		$this->assertSame([5], $write->keptOut);
		$this->assertSame([3, 4], $write->released);
		$this->assertSame([9, 7, 5, 3, 4], $write->fileIds());
	}

	public function testKeepsOnlyTheGivenFileIdsAndEverySeriesItem(): void {
		$write = SeriesWrite::fromRequest([['id' => 12, 'status' => 'open', 'fileIds' => [9, 7]]], [5, 6], [3])->only([7, 6]);
		$this->assertSame([[7]], array_map(static fn ($item): array => $item->fileIds, $write->series));
		$this->assertSame([12], array_map(static fn ($item): ?int => $item->id, $write->series));
		$this->assertSame([6], $write->keptOut);
		$this->assertSame([], $write->released);
	}

	/** @return array{id: ?int, status: string, fileIds: array<int>} */
	private static function item(?int $id, int ...$fileIds): array {
		return ['id' => $id, 'status' => 'open', 'fileIds' => $fileIds];
	}

	/** @return array<string, array{array<array-key, mixed>, array<array-key, mixed>, array<array-key, mixed>}> */
	public static function malformed(): array {
		$item = self::item(null, 7);
		return [
			'series as an object' => [['a' => $item], [], []],
			'an item that is no object' => [[7], [], []],
			'an item without an id' => [[['status' => 'open', 'fileIds' => [7]]], [], []],
			'an id as text' => [[['id' => '12', 'status' => 'open', 'fileIds' => [7]]], [], []],
			'an id of zero' => [[self::item(0, 7)], [], []],
			'a status other than open or done' => [[['id' => null, 'status' => 'closed', 'fileIds' => [7]]], [], []],
			'an item without a status' => [[['id' => null, 'fileIds' => [7]]], [], []],
			'file ids as an object' => [[['id' => null, 'status' => 'open', 'fileIds' => ['a' => 7]]], [], []],
			'a negative file id' => [[self::item(null, -7)], [], []],
			'a kept-out file id as text' => [[], ['7'], []],
			'released as an object' => [[], [], ['a' => 7]],
			'a file id in a series and kept out' => [[$item], [7], []],
			'a file id kept out and released' => [[], [7], [7]],
			'a file id twice in one series' => [[self::item(null, 7, 7)], [], []],
			'a series id twice' => [[self::item(12, 7), self::item(12, 8)], [], []],
			'too many series items' => [array_fill(0, self::SERIES_LIMIT + 1, self::item(null)), [], []],
			'too many file ids in all' => [[self::item(null, ...range(1, self::FILE_LIMIT / 2))], range(self::FILE_LIMIT / 2 + 1, self::FILE_LIMIT), [self::FILE_LIMIT + 1]],
		];
	}

	/**
	 * @param array<array-key, mixed> $series
	 * @param array<array-key, mixed> $keptOut
	 * @param array<array-key, mixed> $released
	 */
	// spec: SERIES-005.23
	#[DataProvider('malformed')]
	public function testRefusesAMalformedBody(array $series, array $keptOut, array $released): void {
		$this->expectException(InvalidRequestException::class);
		SeriesWrite::fromRequest($series, $keptOut, $released);
	}

	// spec: SERIES-005.23
	public function testTakesTheLimitsThemselves(): void {
		$write = SeriesWrite::fromRequest(
			array_fill(0, self::SERIES_LIMIT, ['id' => null, 'status' => 'open', 'fileIds' => []]),
			range(1, self::FILE_LIMIT),
			[],
		);
		$this->assertCount(self::SERIES_LIMIT, $write->series);
		$this->assertCount(self::FILE_LIMIT, $write->fileIds());
	}
}
