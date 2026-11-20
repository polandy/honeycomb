<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\AssetEntries;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichListing;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ImmichStatus;
use OCA\Honeycomb\Immich\ListingCursors;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Security\ICrypto;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** The client against the pinned Immich schema (ADR 0044): what it sends, and the answers it reads. */
final class ImmichContractTest extends TestCase {
	use FakeImmichServer;

	private const string FIXTURES = __DIR__ . '/../../fixtures/immich/';
	private const array ALL_FILTERS = [
		'takenAfter' => 1_793_491_200,
		'takenBefore' => 1_796_083_200,
		'devices' => ['Pixel 9 Pro', null],
		'kinds' => ['photo', 'live', 'video'],
		'flags' => ['unflagged'],
		'rating' => ['op' => 'atMost', 'value' => 3],
		'colourLabels' => [],
	];

	private OpenApiSchema $schema;

	#[\Override]
	protected function setUp(): void {
		$this->schema = new OpenApiSchema();
		$this->immichAnswers('GET /server/version', 200, $this->fixture('version.json'));
		$this->immichAnswers('GET /users/me', 200, $this->fixture('me.json'));
		$this->immichAnswers('POST /search/statistics', 200, $this->fixture('statistics.json'));
		$this->immichAnswers('POST /search/metadata', 200, $this->fixture('search-page.json'));
	}

	/** @return array<string, array{array<string, mixed>}> */
	public static function listings(): array {
		return ['no filter' => [[]], 'every filter' => [self::ALL_FILTERS], 'one device' => [['devices' => ['Pixel 9 Pro']]], 'one kind' => [['kinds' => ['video']]]];
	}

	/** @param array<string, mixed> $filters */
	#[DataProvider('listings')]
	public function testEverySearchTheListingSendsFitsTheSchema(array $filters): void {
		$listing = $this->listing();
		$first = $listing->page($this->connection(), $filters, null, 100);
		$this->assertNotNull($first['nextCursor']);
		$this->assertSame([], $this->schema->requestViolations('POST', '/search/metadata', $this->lastImmichBody('POST /search/metadata')));

		$listing->page($this->connection(), $filters, $first['nextCursor'], 100);
		$this->assertSame([], $this->schema->requestViolations('POST', '/search/metadata', $this->lastImmichBody('POST /search/metadata')));
	}

	public function testTheStatusCallsFitTheSchema(): void {
		$status = (new ImmichStatus($this->client(), new ImmichSearchFilter()))->of($this->connection());

		$this->assertSame(['state' => 'ok', 'account' => 'Alice', 'version' => '3.4.2', 'total' => 3660], $status);
		$this->assertSame([], $this->schema->requestViolations('POST', '/search/statistics', $this->lastImmichBody('POST /search/statistics')));
		$this->assertSame([], $this->schema->requestViolations('POST', '/search/metadata', $this->lastImmichBody('POST /search/metadata')));
	}

	/** @return array<string, array{string, string, string}> */
	public static function answers(): array {
		return [
			'a search page' => ['POST', '/search/metadata', 'search-page.json'],
			'the statistics' => ['POST', '/search/statistics', 'statistics.json'],
			'the version' => ['GET', '/server/version', 'version.json'],
			'the account' => ['GET', '/users/me', 'me.json'],
		];
	}

	#[DataProvider('answers')]
	public function testEveryAnswerFixtureFitsTheSchema(string $method, string $path, string $fixture): void {
		$this->assertSame([], $this->schema->responseViolations($method, $path, 200, $this->fixture($fixture)));
	}

	public function testTheSearchFixtureParsesIntoEntries(): void {
		$entries = $this->listing()->page($this->connection(), [], null, 100)['entries'];

		$this->assertSame(['photo', 'live', 'video', 'photo'], array_column($entries, 'kind'));
		$this->assertSame([null, null, 12.5, null], array_column($entries, 'duration'));
		$this->assertSame(3, $entries[3]['stackSize']);
	}

	public function testTheSchemaCheckCatchesAFieldImmichDoesNotKnow(): void {
		$body = ['filter' => ['libraryId' => ['eq' => null], 'kinds' => ['in' => ['IMAGE']]], 'size' => 2000, 'page' => 1];

		$this->assertSame(['$.filter.kinds is not in the schema', '$.size is out of range', '$.page is deprecated'], $this->schema->requestViolations('POST', '/search/metadata', $body));
	}

	private function fixture(string $name): mixed {
		/** @psalm-suppress ForbiddenCode Reads a test fixture, not a user file. */
		return json_decode((string)file_get_contents(self::FIXTURES . $name), true, 512, JSON_THROW_ON_ERROR);
	}

	private function client(): ImmichClient {
		$files = new FakeLocalFiles();
		$files->files['/keys/alice-phone.key'] = 'key';
		return new ImmichClient($this->immichClients(), $files, new FakeLogger());
	}

	private function listing(): ImmichListing {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(1_795_000_000);
		$crypto = $this->createStub(ICrypto::class);
		$crypto->method('calculateHMAC')->willReturnCallback(static fn (string $message): string => hash_hmac('sha256', $message, 'secret'));
		return new ImmichListing($this->client(), new ImmichSearchFilter(), new ListingCursors($crypto), new AssetEntries(), $time);
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}
}
