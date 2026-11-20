<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\AssetEntries;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichListing;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ListingCursors;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Security\ICrypto;
use PHPUnit\Framework\TestCase;

final class ImmichListingTest extends TestCase {
	use AssertsImmichFailure;
	use FakeImmichServer;

	private const int NOW = 1_795_000_000;

	private FakeImmichLibrary $library;
	private int $now = self::NOW;

	#[\Override]
	protected function setUp(): void {
		$this->library = new FakeImmichLibrary();
		$this->immichRoute('POST /search/metadata', fn (array $options): array => $this->library->search($options));
	}

	// spec: IMMICH-002.1
	public function testTheCursorsWalkEveryUploadOnceNewestFirst(): void {
		foreach (range(1, 250) as $n) {
			$this->library->add(sprintf('00000000-0000-4000-8000-%012d', $n), self::NOW - 3600 * $n);
		}

		$pages = $this->walk([], 100);

		$this->assertSame([100, 100, 50], array_map('count', $pages));
		$ids = array_merge(...$pages);
		$this->assertSame(array_map(static fn (int $n): string => sprintf('00000000-0000-4000-8000-%012d', $n), range(1, 250)), $ids);
	}

	// spec: IMMICH-002.2
	public function testUploadsOfOneSecondAreOrderedByIdAcrossAPageBoundary(): void {
		foreach (['c', 'a', 'e', 'b', 'd'] as $letter) {
			$this->library->add("$letter$letter$letter$letter$letter$letter$letter$letter-0000-4000-8000-000000000000", self::NOW - 60);
		}

		$ids = array_merge(...$this->walk([], 2));

		$this->assertSame(['e', 'd', 'c', 'b', 'a'], array_map(static fn (string $id): string => $id[0], $ids));
	}

	// spec: IMMICH-002.21
	public function testAnUploadDuringThePagingShiftsNoPageAndShowsOnTheNextStart(): void {
		foreach (range(1, 4) as $n) {
			$this->library->add("old-$n", self::NOW - 600 * $n, self::NOW - 60);
		}
		$first = $this->listing()->page($this->connection(), [], null, 2);

		$this->now = self::NOW + 30;
		$this->library->add('new-1', self::NOW + 20, self::NOW + 20);
		$second = $this->listing()->page($this->connection(), [], $first['nextCursor'], 2);

		$this->assertSame(['old-3', 'old-4'], array_column($second['entries'], 'assetId'));
		$this->assertNull($second['nextCursor']);
		$this->assertSame(['new-1', 'old-1'], array_column($this->listing()->page($this->connection(), [], null, 2)['entries'], 'assetId'));
	}

	// spec: IMMICH-002.4
	public function testEachPictureIsOneEntryWithItsFieldsAndAnUndecidedDecision(): void {
		$this->library->add('photo', self::NOW - 10);
		$this->library->add('live', self::NOW - 20, 0, ['livePhotoVideoId' => 'motion-part', 'exifInfo' => ['model' => null]]);
		$this->library->add('video', self::NOW - 30, 0, ['type' => 'VIDEO', 'duration' => 12500, 'originalFileName' => 'PXL_video.mp4']);
		$this->library->add('stack-primary', self::NOW - 40, 0, ['stack' => ['id' => 's', 'primaryAssetId' => 'stack-primary', 'assetCount' => 3]]);
		$this->library->add('stack-member', self::NOW - 50, 0, ['stack' => ['id' => 's', 'primaryAssetId' => 'stack-primary', 'assetCount' => 3]]);

		$entries = $this->listing()->page($this->connection(), [], null, 100)['entries'];

		$this->assertSame(['assetId' => 'photo', 'name' => 'PXL_photo.jpg', 'takenAt' => self::NOW - 10, 'cameraModel' => 'Pixel 9 Pro', 'kind' => 'photo', 'width' => 4080, 'height' => 3072, 'duration' => null, 'stackSize' => null, 'updatedAt' => '2026-11-19T08:00:00.000Z', 'rating' => 0, 'colourLabel' => null, 'flag' => 'unflagged', 'keepRaw' => false], $entries[0]);
		$this->assertSame(['live', null, null], [$entries[1]['kind'], $entries[1]['cameraModel'], $entries[1]['duration']]);
		$this->assertSame(['video', 12.5], [$entries[2]['kind'], $entries[2]['duration']]);
		$this->assertSame(['stack-primary', 3], [$entries[3]['assetId'], $entries[3]['stackSize']]);
		$this->assertCount(4, $entries);
	}

	public function testThePageAsksOneSearchNewestFirstWithExifAndStacks(): void {
		$this->listing()->page($this->connection(), ['kinds' => ['photo']], null, 40);

		$body = $this->lastImmichBody('POST /search/metadata');
		$this->assertIsArray($body);
		$this->assertSame(['field' => 'fileCreatedAt', 'direction' => 'desc'], $body['orderBy']);
		$this->assertSame([40, true, true], [$body['size'], $body['withExif'], $body['withStacked']]);
		$this->assertArrayNotHasKey('cursor', $body);
		$this->assertSame([['type' => ['eq' => 'IMAGE'], 'isMotion' => ['eq' => false]]], $body['filter']['or']);
	}

	// spec: IMMICH-002.5
	public function testASizeOutsideOneTo250IsABadRequest(): void {
		foreach ([0, 251] as $size) {
			$this->assertFailsWith(ImmichError::Request, fn () => $this->listing()->page($this->connection(), [], null, $size));
		}
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-002.5
	public function testACursorOfOtherFiltersIsABadRequest(): void {
		foreach (range(1, 3) as $n) {
			$this->library->add("asset-$n", self::NOW - $n);
		}
		$cursor = $this->listing()->page($this->connection(), ['kinds' => ['photo']], null, 1)['nextCursor'];

		$this->assertFailsWith(ImmichError::Request, fn () => $this->listing()->page($this->connection(), ['kinds' => ['video']], $cursor, 1));
	}

	public function testADecisionFilterNoUndecidedPicturePassesIsAnEmptyPageWithoutAsking(): void {
		$this->library->add('photo', self::NOW - 10);

		$this->assertSame(['entries' => [], 'nextCursor' => null, 'previousCursor' => null], $this->listing()->page($this->connection(), ['flags' => ['picked']], null, 100));
		$this->assertSame([], $this->immichRequests);
		$this->assertCount(1, $this->listing()->page($this->connection(), ['flags' => ['unflagged']], null, 100)['entries']);
	}

	// spec: IMMICH-001.16
	public function testAnAssetOfAnotherShapeIsTheVersionState(): void {
		$this->library->add('photo', self::NOW - 10, 0, ['fileCreatedAt' => 'yesterday']);

		$this->assertFailsWith(ImmichError::Version, fn () => $this->listing()->page($this->connection(), [], null, 100));
	}

	/**
	 * The asset ids of every page, cursor by cursor.
	 * @param array<string, mixed> $filters
	 * @return list<list<string>>
	 */
	private function walk(array $filters, int $size): array {
		$pages = [];
		$cursor = null;
		do {
			$page = $this->listing()->page($this->connection(), $filters, $cursor, $size);
			$this->assertNull($page['previousCursor']);
			$pages[] = array_column($page['entries'], 'assetId');
			$cursor = $page['nextCursor'];
		} while ($cursor !== null && count($pages) < 10);
		return $pages;
	}

	private function listing(): ImmichListing {
		$files = new FakeLocalFiles();
		$files->files['/keys/alice-phone.key'] = 'key';
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->now);
		$crypto = $this->createStub(ICrypto::class);
		$crypto->method('calculateHMAC')->willReturnCallback(static fn (string $message): string => hash_hmac('sha256', $message, 'secret'));
		$client = new ImmichClient($this->immichClients(), $files, new FakeLogger());
		return new ImmichListing($client, new ImmichSearchFilter(), new ListingCursors($crypto), new AssetEntries(), $time);
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}
}
