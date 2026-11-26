<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use DateTimeZone;
use OCA\Honeycomb\Service\Listing\RawExif;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RawExifTest extends TestCase {
	/** 2026-11-25 14:03:09 UTC. */
	private const int UTC_TIME = 1_795_615_389;
	private const int HOUR = 3_600;

	// spec: LISTING-004.4
	public function testStoresTheCaptureTimeInTheZoneOfItsOffset(): void {
		$value = RawExif::of(['DateTimeOriginal' => '2026:11:25 14:03:09', 'OffsetTimeOriginal' => '+02:00', 'Make' => 'Canon', 'Model' => 'EOS R5'], new DateTimeZone('UTC'));

		$this->assertSame(['DateTimeOriginal' => self::UTC_TIME - 2 * self::HOUR, 'Make' => 'Canon', 'Model' => 'EOS R5'], $value);
	}

	/** @return array<string, array{?string}> offsets that count as none */
	public static function noOffset(): array {
		return ['none' => [null], 'a name' => ['Europe/Zurich'], 'out of range' => ['+15:00'], 'without a colon' => ['+0200'], 'empty' => ['']];
	}

	// spec: LISTING-004.4
	#[DataProvider('noOffset')]
	public function testStoresATimeWithoutAValidOffsetInTheServerZone(?string $offset): void {
		$fields = ['DateTimeOriginal' => '2026:11:25 14:03:09'] + ($offset === null ? [] : ['OffsetTimeOriginal' => $offset]);

		$this->assertSame(['DateTimeOriginal' => self::UTC_TIME - self::HOUR], RawExif::of($fields, new DateTimeZone('Europe/Zurich')));
	}

	/** @return array<string, array{string}> */
	public static function noDate(): array {
		return ['zeros' => ['0000:00:00 00:00:00'], 'a day that does not exist' => ['2026:02:30 10:00:00'], 'dashes' => ['2026-11-25 14:03:09'], 'no time' => ['2026:11:25'], 'text' => ['unknown']];
	}

	// spec: LISTING-004.5
	#[DataProvider('noDate')]
	public function testLeavesOutADateThatIsNoRealDate(string $dateTime): void {
		$this->assertSame(['Model' => 'X-T5'], RawExif::of(['DateTimeOriginal' => $dateTime, 'Model' => 'X-T5'], new DateTimeZone('UTC')));
	}

	// spec: LISTING-004.6
	public function testStoresAnEmptyValueForAHeaderWithoutValues(): void {
		$this->assertSame([], RawExif::of([], new DateTimeZone('UTC')));
	}
}
