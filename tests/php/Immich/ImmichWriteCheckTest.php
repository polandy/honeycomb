<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ImmichWriteCheck;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichWriteCheckTest extends TestCase {
	use AssertsImmichFailure;
	use FakeImmichServer;

	private const string TRASHED = '00000000-0000-4000-8000-000000000001';
	private const string ARCHIVED = '00000000-0000-4000-8000-000000000002';
	private const string SHARED = '00000000-0000-4000-8000-000000000003';
	private const string STACK_TOP = '00000000-0000-4000-8000-000000000004';
	private const string GONE = '00000000-0000-4000-8000-000000000005';
	private const string IN_STACK = '00000000-0000-4000-8000-000000000006';
	private const string STACK = 'a0000000-0000-4000-8000-000000000001';
	private const string UPDATED = '2026-11-21T20:33:35.789Z';
	private const string FIXTURES = __DIR__ . '/../../fixtures/immich/';

	private FakeImmichLibrary $library;

	#[\Override]
	protected function setUp(): void {
		$this->library = new FakeImmichLibrary();
		$this->immichRoute('POST /search/metadata', fn (array $options): array => $this->library->search($options));
		$this->immichRoute('GET /albums', fn (array $options): array => [200, $this->albumsOf($options), 'application/json']);
		$this->held(self::TRASHED, ['isTrashed' => true, 'exifInfo' => ['rating' => 3]]);
		$this->held(self::ARCHIVED, ['visibility' => 'archive', 'exifInfo' => null]);
		$this->held(self::SHARED, ['isFavorite' => true, 'exifInfo' => ['rating' => -1]]);
		$this->held(self::STACK_TOP, ['stack' => ['id' => self::STACK, 'primaryAssetId' => self::STACK_TOP, 'assetCount' => 3]]);
		$this->held(self::IN_STACK, ['stack' => ['id' => self::STACK, 'primaryAssetId' => self::STACK_TOP, 'assetCount' => 3]]);
	}

	// spec: IMMICH-004.18
	public function testItAnswersEachHeldAssetsStateInTheAskedOrder(): void {
		/** @var array<string, mixed> $answer */
		$answer = $this->check()->check($this->connection(), [self::STACK_TOP, self::GONE, self::TRASHED, self::ARCHIVED, self::SHARED, self::IN_STACK]);

		$state = static fn (string $id, ?int $rating, bool $favorite, bool $trashed, bool $archived, ?array $album, ?int $stack): array => [
			'assetId' => $id, 'updatedAt' => self::UPDATED, 'rating' => $rating, 'favorite' => $favorite, 'trashed' => $trashed,
			'archived' => $archived, 'sharedAlbum' => $album, 'stackSize' => $stack,
		];
		$this->assertSame(['assets' => [
			$state(self::STACK_TOP, null, false, false, false, null, 3),
			$state(self::TRASHED, 3, false, true, false, null, null),
			$state(self::ARCHIVED, null, false, false, true, null, null),
			$state(self::SHARED, -1, true, false, false, ['name' => 'Family summer', 'others' => 2], null),
			$state(self::IN_STACK, null, false, false, false, null, null),
		]], $answer);
	}

	// spec: IMMICH-004.18
	public function testItSearchesTheAskedAssetsWhereverImmichHoldsThem(): void {
		$this->check()->check($this->connection(), [self::TRASHED, self::GONE]);

		$this->assertSame([
			'filter' => (new ImmichSearchFilter())->heldByIds([self::TRASHED, self::GONE]),
			'size' => 2, 'withExif' => true, 'withStacked' => true,
		], $this->lastImmichBody('POST /search/metadata'));
	}

	// spec: IMMICH-004.18
	public function testAnAnswerBeyondTheAskedAssetsAddsNothing(): void {
		$this->immichAnswers('POST /search/metadata', 200, ['assets' => ['items' => [$this->library->assets[0]], 'nextCursor' => null]]);

		$this->assertSame(['assets' => []], $this->check()->check($this->connection(), [self::GONE]));
	}

	public function testNoAssetHeldAsksForNoAlbum(): void {
		$this->assertSame(['assets' => []], $this->check()->check($this->connection(), [self::GONE]));

		$this->assertSame(['POST'], array_column($this->immichRequests, 'method'));
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		$id = self::TRASHED;
		return [
			'no body' => [null],
			'no asset' => [[]],
			'no list' => [['a' => $id]],
			'an id twice' => [[$id, $id]],
			'an id in capitals' => [[strtoupper('e291f677-5188-461e-887e-048f9ce0b1dc')]],
			'a number' => [[7]],
			'a text' => [$id],
			'101 assets' => [array_map(static fn (int $n): string => sprintf('00000000-0000-4000-8000-%012d', $n), range(1, 101))],
		];
	}

	// spec: IMMICH-004.5
	// spec: IMMICH-004.18
	#[DataProvider('malformed')]
	public function testAMalformedBodyIsABadRequestAndAsksImmichNothing(mixed $body): void {
		$this->assertFailsWith(ImmichError::Request, fn (): array => $this->check()->check($this->connection(), $body));

		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-004.5
	public function testOneHundredAssetsAreOneRequest(): void {
		$ids = array_map(static fn (int $n): string => sprintf('00000000-0000-4000-8000-%012d', $n), range(1, 100));

		$this->check()->check($this->connection(), $ids);

		$this->assertSame(100, $this->lastImmichBody('POST /search/metadata')['size'] ?? null);
	}

	public function testAKeyWithoutAlbumReadNamesTheScope(): void {
		$this->immichAnswers('GET /albums', 403, ['message' => 'Missing required permission: album.read']);

		$failure = $this->assertFailsWith(ImmichError::Scope, fn (): array => $this->check()->check($this->connection(), [self::SHARED]));

		$this->assertSame('album.read', $failure->scope);
	}

	public function testAnImmichThatDoesNotAnswerIsUnreachable(): void {
		$this->immichDown('POST /search/metadata');

		$this->assertFailsWith(ImmichError::Unreachable, fn (): array => $this->check()->check($this->connection(), [self::SHARED]));
	}

	/** @return array<string, array{array<string, mixed>}> */
	public static function unfitAssets(): array {
		return [
			'no updatedAt' => [['updatedAt' => null]],
			'a favourite as text' => [['isFavorite' => 'yes']],
			'no trash state' => [['isTrashed' => null]],
			'no visibility' => [['visibility' => 7]],
			'a rating as text' => [['exifInfo' => ['rating' => '4']]],
			'a stack without size' => [['stack' => ['id' => self::STACK, 'primaryAssetId' => self::SHARED]]],
		];
	}

	/** @param array<string, mixed> $override */
	#[DataProvider('unfitAssets')]
	public function testAnAssetThatDoesNotFitIsTheVersion(array $override): void {
		$this->library->assets = [];
		$this->held(self::SHARED, $override);

		$this->assertFailsWith(ImmichError::Version, fn (): array => $this->check()->check($this->connection(), [self::SHARED]));
	}

	/** @return array<string, array{mixed}> */
	public static function unfitAlbums(): array {
		return [
			'no list' => [['albumName' => 'Family summer']],
			'no shared state' => [[['albumName' => 'Family summer', 'albumUsers' => []]]],
			'no name' => [[['shared' => true, 'albumUsers' => []]]],
			'no members' => [[['albumName' => 'Family summer', 'shared' => true]]],
		];
	}

	#[DataProvider('unfitAlbums')]
	public function testAnAlbumAnswerThatDoesNotFitIsTheVersion(mixed $albums): void {
		$this->immichAnswers('GET /albums', 200, $albums);

		$this->assertFailsWith(ImmichError::Version, fn (): array => $this->check()->check($this->connection(), [self::SHARED]));
	}

	/** @param array<string, mixed> $override */
	private function held(string $id, array $override): void {
		$this->library->add($id, 1_795_000_000, 0, [
			'updatedAt' => self::UPDATED, 'isFavorite' => false, 'isTrashed' => false, 'visibility' => 'timeline', ...$override,
		]);
	}

	/** The fixture's albums, one of them shared, for the shared asset; none for the others. */
	private function albumsOf(array $options): string {
		/** @var array{query?: array{assetId?: string}} $options */
		$assetId = $options['query']['assetId'] ?? null;
		/** @psalm-suppress ForbiddenCode Reads a test fixture, not a user file. */
		return $assetId === self::SHARED ? (string)file_get_contents(self::FIXTURES . 'albums-of-asset.json') : '[]';
	}

	private function check(): ImmichWriteCheck {
		$files = new FakeLocalFiles();
		$files->files['/keys/alice-phone.key'] = 'key';
		return new ImmichWriteCheck(new ImmichClient($this->immichClients(), $files, new FakeLogger()), new ImmichSearchFilter());
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}
}
