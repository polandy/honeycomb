<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ListingFilters;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ListingFiltersTest extends TestCase {
	use AssertsImmichFailure;

	private const int RECEIVED_BEFORE = 1_795_000_000;
	private const string RECEIVED_BEFORE_DATE = '2026-11-18T11:06:40Z';

	/** @return array<string, array{array<string, mixed>}> */
	public static function malformedFilters(): array {
		return [
			'an unknown filter' => [['albums' => []]],
			'a time not a number' => [['takenAfter' => '2026-11-01']],
			'a negative time' => [['takenBefore' => -1]],
			'devices not a list' => [['devices' => 'Pixel 9']],
			'an empty device' => [['devices' => ['']]],
			'a device not a string' => [['devices' => [7]]],
			'more than 20 devices' => [['devices' => array_map(static fn (int $n): string => "Model $n", range(1, 21))]],
			'an unknown kind' => [['kinds' => ['screenshot']]],
			'an unknown flag' => [['flags' => ['maybe']]],
			'an unknown rating op' => [['rating' => ['op' => 'above', 'value' => 3]]],
			'a rating out of range' => [['rating' => ['op' => 'atLeast', 'value' => 6]]],
			'a rating without value' => [['rating' => ['op' => 'atLeast']]],
			'an unknown colour label' => [['colourLabels' => ['pink']]],
		];
	}

	// spec: IMMICH-002.5
	/** @param array<string, mixed> $raw */
	#[DataProvider('malformedFilters')]
	public function testAMalformedFilterIsABadRequest(array $raw): void {
		$this->assertFailsWith(ImmichError::Request, static fn () => new ListingFilters($raw));
	}

	public function testTwentyDevicesAreStillOneSearch(): void {
		$devices = array_map(static fn (int $n): string => "Model $n", range(1, 20));

		$this->assertSame($devices, (new ListingFilters(['devices' => $devices]))->devices);
	}

	// spec: IMMICH-002.3
	public function testTheSearchAsksForTheUploadLibrarysVisiblePhotosAndVideosOnly(): void {
		$this->assertSame([
			'libraryId' => ['eq' => null],
			'visibility' => ['eq' => 'timeline'],
			'trashedAt' => ['eq' => null],
			'type' => ['in' => ['IMAGE', 'VIDEO']],
		], (new ImmichSearchFilter())->uploads());
		$this->assertSame([...(new ImmichSearchFilter())->uploads(), 'createdAt' => ['lte' => self::RECEIVED_BEFORE_DATE]], $this->search([]));
	}

	// spec: IMMICH-002.11
	public function testTheTimeFilterIsHalfOpenOnTheCaptureTime(): void {
		$filter = $this->search(['takenAfter' => 1_793_491_200, 'takenBefore' => 1_796_083_200]);

		$this->assertSame(['gte' => '2026-11-01T00:00:00Z', 'lt' => '2026-12-01T00:00:00Z'], $filter['takenAt']);
		$this->assertArrayNotHasKey('takenAt', $this->search(['takenAfter' => null, 'takenBefore' => null]));
		$this->assertSame(['lt' => '2026-12-01T00:00:00Z'], $this->search(['takenBefore' => 1_796_083_200])['takenAt']);
	}

	// spec: IMMICH-002.12
	public function testDevicesAndKindsAreTheBranchesOfOneSearch(): void {
		$filter = $this->search(['devices' => ['Pixel 9 Pro', null, 'iPhone 16'], 'kinds' => ['video', 'live']]);

		$this->assertSame([
			['model' => ['in' => ['Pixel 9 Pro', 'iPhone 16']], 'type' => ['eq' => 'VIDEO']],
			['model' => ['in' => ['Pixel 9 Pro', 'iPhone 16']], 'type' => ['eq' => 'IMAGE'], 'isMotion' => ['eq' => true]],
			['model' => ['eq' => null], 'type' => ['eq' => 'VIDEO']],
			['model' => ['eq' => null], 'type' => ['eq' => 'IMAGE'], 'isMotion' => ['eq' => true]],
		], $filter['or']);
	}

	// spec: IMMICH-002.12
	public function testOneGroupAloneMakesOneBranchPerChoice(): void {
		$this->assertSame([['type' => ['eq' => 'IMAGE'], 'isMotion' => ['eq' => false]]], $this->search(['kinds' => ['photo']])['or']);
		$this->assertSame([['model' => ['in' => ['Pixel 9']]]], $this->search(['devices' => ['Pixel 9']])['or']);
		$this->assertSame([['model' => ['eq' => null]]], $this->search(['devices' => [null]])['or']);
		$this->assertArrayNotHasKey('or', $this->search(['devices' => [], 'kinds' => []]));
	}

	/** @return array<string, array{array<string, mixed>, bool}> */
	public static function decisionFilters(): array {
		return [
			'none' => [[], true],
			'unflagged among the flags' => [['flags' => ['picked', 'unflagged']], true],
			'picked only' => [['flags' => ['picked']], false],
			'at least 0 stars' => [['rating' => ['op' => 'atLeast', 'value' => 0]], true],
			'at most 2 stars' => [['rating' => ['op' => 'atMost', 'value' => 2]], true],
			'exactly 0 stars' => [['rating' => ['op' => 'exactly', 'value' => 0]], true],
			'at least 1 star' => [['rating' => ['op' => 'atLeast', 'value' => 1]], false],
			'exactly 3 stars' => [['rating' => ['op' => 'exactly', 'value' => 3]], false],
			'a colour label' => [['colourLabels' => ['red']], false],
		];
	}

	/** @param array<string, mixed> $raw */
	#[DataProvider('decisionFilters')]
	public function testTheDecisionFilterSaysWhetherAnUndecidedAssetPasses(array $raw, bool $admits): void {
		$this->assertSame($admits, (new ListingFilters($raw))->admitsUndecided());
	}

	public function testTheFingerprintIgnoresOrderAndRepeatsButNotTheChoices(): void {
		$one = new ListingFilters(['kinds' => ['photo', 'video'], 'devices' => ['A', null]]);
		$same = new ListingFilters(['devices' => [null, 'A', 'A'], 'kinds' => ['video', 'photo']]);
		$other = new ListingFilters(['kinds' => ['photo']]);

		$this->assertSame($one->fingerprint(), $same->fingerprint());
		$this->assertNotSame($one->fingerprint(), $other->fingerprint());
	}

	/**
	 * @param array<string, mixed> $raw
	 * @return array<string, mixed>
	 */
	private function search(array $raw): array {
		return (new ImmichSearchFilter())->of(new ListingFilters($raw), self::RECEIVED_BEFORE);
	}
}
