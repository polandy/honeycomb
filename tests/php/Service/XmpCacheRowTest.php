<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpReadState;
use OCA\Honeycomb\Service\XmpSource;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class XmpCacheRowTest extends TestCase {
	/** A row of a sidecar that states every value. */
	public static function item(array $changes = []): array {
		return [
			'fileId' => 9,
			'kind' => 'sidecar',
			'etag' => 'etag-9',
			'reader' => 1,
			'state' => 'read',
			'reason' => null,
			'rating' => 4,
			'flag' => 'rejected',
			'colourLabel' => 'red',
			'keepRaw' => true,
			'tags' => ['People/Anna', 'Holiday'],
			...$changes,
		];
	}

	// spec: XMP-006.1
	public function testReadsEveryFieldOfARequestItem(): void {
		$row = XmpCacheRow::fromRequest(self::item());

		$this->assertEquals(new XmpCacheRow(9, XmpSource::Sidecar, 'etag-9', 1, XmpReadState::Read, null, 4, Flag::Rejected, ColourLabel::Red, true, ['Holiday', 'People/Anna']), $row);
	}

	// spec: XMP-006.1
	public function testWritesTheWireFormBack(): void {
		$item = self::item(['tags' => ['Holiday', 'People/Anna']]);

		$this->assertSame($item, XmpCacheRow::fromRequest($item)->jsonSerialize());
	}

	// spec: XMP-006.1
	public function testEveryValueMayBeNull(): void {
		$item = self::item(['kind' => 'embedded', 'state' => 'none', 'rating' => null, 'flag' => null, 'colourLabel' => null, 'keepRaw' => null, 'tags' => null]);

		$this->assertSame($item, XmpCacheRow::fromRequest($item)->jsonSerialize());
	}

	// spec: XMP-006.1
	public function testARefusedRowKeepsItsReason(): void {
		$item = self::item(['state' => 'refused', 'reason' => 'not-utf-8', 'rating' => null, 'flag' => null, 'colourLabel' => null, 'keepRaw' => null, 'tags' => null]);

		$this->assertSame($item, XmpCacheRow::fromRequest($item)->jsonSerialize());
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		return [
			'not an object' => ['row'],
			'file id zero' => [self::item(['fileId' => 0])],
			'file id a string' => [self::item(['fileId' => '9'])],
			'unknown kind' => [self::item(['kind' => 'raw'])],
			'empty etag' => [self::item(['etag' => ''])],
			'etag too long' => [self::item(['etag' => str_repeat('e', 41)])],
			'reader zero' => [self::item(['reader' => 0])],
			'unknown state' => [self::item(['state' => 'stale'])],
			'refused without reason' => [self::item(['state' => 'refused'])],
			'reason without refusal' => [self::item(['reason' => 'malformed'])],
			'malformed reason' => [self::item(['state' => 'refused', 'reason' => 'Not UTF-8!'])],
			'rating six' => [self::item(['rating' => 6])],
			'rating below zero' => [self::item(['rating' => -1])],
			'unknown flag' => [self::item(['flag' => 'maybe'])],
			'unknown colour label' => [self::item(['colourLabel' => 'pink'])],
			'keep raw a number' => [self::item(['keepRaw' => 1])],
			'tags not a list' => [self::item(['tags' => 'Anna'])],
			'malformed tag' => [self::item(['tags' => ['People//Anna']])],
			'missing field' => [array_diff_key(self::item(), ['flag' => null])],
		];
	}

	// spec: XMP-006.4
	#[DataProvider('malformed')]
	public function testRefusesAMalformedItem(mixed $item): void {
		$this->expectException(InvalidRequestException::class);
		XmpCacheRow::fromRequest($item);
	}
}
