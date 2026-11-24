<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileIds;
use OCA\Honeycomb\Service\InvalidRequestException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class FileIdsTest extends TestCase {
	private const int LIMIT = 3;

	public function testPassesAListWithinTheLimitThrough(): void {
		$this->assertSame([['a' => 1], 'b', 3], FileIds::items([['a' => 1], 'b', 3], self::LIMIT));
		$this->assertSame([], FileIds::items([], self::LIMIT));
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedLists(): array {
		return [
			'not a list' => [['a' => 1]],
			'keys out of order' => [[1 => 1, 0 => 2]],
			'over the limit' => [[1, 2, 3, 4]],
		];
	}

	#[DataProvider('malformedLists')]
	public function testRejectsAnythingButAListWithinTheLimit(array $items): void {
		$this->expectException(InvalidRequestException::class);

		FileIds::items($items, self::LIMIT);
	}

	public function testParsesPositiveFileIdsInRequestOrder(): void {
		$this->assertSame([9, 1, 9], FileIds::parse([9, 1, 9], self::LIMIT));
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedFileIds(): array {
		return [
			'not a list' => [['a' => 1]],
			'over the limit' => [[1, 2, 3, 4]],
			'a text id' => [[1, '2']],
			'a float id' => [[1.0]],
			'a null id' => [[null]],
			'a zero id' => [[0]],
			'a negative id' => [[-1]],
		];
	}

	#[DataProvider('malformedFileIds')]
	public function testRejectsAnythingButPositiveIntegers(array $fileIds): void {
		$this->expectException(InvalidRequestException::class);

		FileIds::parse($fileIds, self::LIMIT);
	}

	public function testAcceptsEachFileIdOnce(): void {
		$this->assertSame([3, 1, 2], FileIds::eachOnce([3, 1, 2]));
		$this->assertSame([], FileIds::eachOnce([]));
	}

	public function testRejectsAFileIdGivenTwice(): void {
		$this->expectException(InvalidRequestException::class);

		FileIds::eachOnce([1, 2, 1]);
	}
}
