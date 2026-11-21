<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichClientTest extends TestCase {
	use AssertsImmichFailure;
	use FakeImmichServer;

	private const string KEY = 'k3y-Of-Alice';
	private const string KEY_FILE = '/run/secrets/honeycomb/alice-phone.key';
	private const string ASSET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

	private FakeLocalFiles $files;
	private FakeLogger $logger;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeLocalFiles();
		$this->files->files[self::KEY_FILE] = '  ' . self::KEY . "\n";
		$this->logger = new FakeLogger();
		$this->immichAnswers('POST /search/metadata', 200, ['albums' => [], 'assets' => ['count' => 0, 'facets' => [], 'items' => [], 'nextCursor' => null, 'nextPage' => null, 'total' => 0]]);
	}

	// spec: IMMICH-001.6
	public function testTheTrimmedKeyGoesInTheApiKeyHeaderOnly(): void {
		$this->client()->search($this->connection(), ['size' => 1]);

		$request = $this->immichRequests[0];
		$this->assertSame('http://immich-server:2283/api/search/metadata', $request['url']);
		/** @var array<string, string> $headers */
		$headers = $request['options']['headers'];
		$this->assertSame(self::KEY, $headers['x-api-key']);
		$this->assertStringNotContainsString(self::KEY, json_encode([$request['url'], $request['options']['body'] ?? null], JSON_THROW_ON_ERROR));
		$this->assertSame(['size' => 1], $this->lastImmichBody('POST /search/metadata'));
	}

	// spec: IMMICH-001.6
	public function testNoFailureCarriesTheKeyIntoAMessageOrALogLine(): void {
		$messages = [];
		foreach ([function (): void {
			$this->immichDown('POST /search/metadata');
		}, function (): void {
			$this->immichAnswers('POST /search/metadata', 401);
		}, function (): void {
			$this->immichAnswers('POST /search/metadata', 500);
		}, function (): void {
			$this->immichAnswers('POST /search/metadata', 200, ['x' => self::KEY]);
		}] as $setUp) {
			$setUp();
			try {
				$this->client()->search($this->connection(), []);
			} catch (ImmichException $failure) {
				$messages[] = $failure->getMessage();
			}
		}

		$this->assertCount(4, $messages);
		$this->assertStringNotContainsString(self::KEY, json_encode([$messages, $this->logger->lines], JSON_THROW_ON_ERROR));
	}

	// spec: IMMICH-001.6
	public function testItFollowsNoRedirectSoTheKeyStaysWithTheConnection(): void {
		$this->client()->search($this->connection(), []);

		$this->assertFalse($this->immichRequests[0]['options']['allow_redirects']);
	}

	public function testItCallsImmichWithShortTimeoutsAndAllowsALocalAddress(): void {
		$this->client()->search($this->connection(), []);

		$options = $this->immichRequests[0]['options'];
		$this->assertSame(5, $options['connect_timeout']);
		$this->assertSame(30, $options['timeout']);
		$this->assertFalse($options['http_errors']);
		$this->assertSame(['allow_local_address' => true], $options['nextcloud']);
	}

	public function testTheVersionNeedsNoKey(): void {
		unset($this->files->files[self::KEY_FILE]);
		$this->immichAnswers('GET /server/version', 200, ['major' => 3, 'minor' => 4, 'patch' => 2, 'prerelease' => null, 'featureLevel' => 0]);

		$this->assertSame(['major' => 3, 'minor' => 4, 'patch' => 2], $this->client()->version($this->connection()));
		$this->assertSame([], $this->files->reads);
		$this->assertArrayNotHasKey('x-api-key', (array)($this->immichRequests[0]['options']['headers'] ?? []));
	}

	/** @return array<string, array{?string}> */
	public static function badKeyFiles(): array {
		return ['missing' => [null], 'empty' => [''], 'only whitespace' => [" \n"]];
	}

	// spec: IMMICH-001.7
	#[DataProvider('badKeyFiles')]
	public function testABadKeyFileIsTheKeyStateLoggedWithTheConnectionButNotItsPath(?string $content): void {
		if ($content === null) {
			unset($this->files->files[self::KEY_FILE]);
		} else {
			$this->files->files[self::KEY_FILE] = $content;
		}

		$this->assertFailsWith(ImmichError::Key, fn () => $this->client()->search($this->connection(), []));
		$this->assertSame([], $this->immichRequests);
		$this->assertCount(1, $this->logger->lines);
		$this->assertStringContainsString('alice-phone', $this->logger->lines[0]['line']);
		$this->assertStringNotContainsString(self::KEY_FILE, $this->logger->lines[0]['line']);
	}

	/** @return array<string, array{\Closure(self): void, ImmichError}> */
	public static function failedAnswers(): array {
		return [
			'no answer in time' => [static fn (self $test) => $test->immichDown('POST /search/metadata'), ImmichError::Unreachable],
			'a server error' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 503), ImmichError::Unreachable],
			'the key refused' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 401), ImmichError::Refused],
			'a bad request' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 400, ['message' => 'filter.foo should not exist']), ImmichError::Version],
			'a redirect' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 302), ImmichError::Version],
			'another 4xx' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 418), ImmichError::Version],
			'a body not in the schema' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 200, ['assets' => ['items' => 'none']]), ImmichError::Version],
			'a cursor not a string' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 200, ['assets' => ['items' => [], 'nextCursor' => 7]]), ImmichError::Version],
			'a body not JSON' => [static fn (self $test) => $test->immichRoute('POST /search/metadata', static fn (): array => [200, '<html>', 'text/html']), ImmichError::Version],
		];
	}

	// spec: IMMICH-001.8, IMMICH-001.16
	/** @param \Closure(self): void $answer */
	#[DataProvider('failedAnswers')]
	public function testEveryCallMapsImmichsAnswerToOneState(\Closure $answer, ImmichError $error): void {
		$answer($this);

		$this->assertFailsWith($error, fn () => $this->client()->search($this->connection(), []));
		$this->assertNotSame([], $this->logger->lines);
	}

	/** @return array<string, array{string, \Closure(ImmichClient, Connection): mixed, string}> */
	public static function scopedCalls(): array {
		return [
			'the listing' => ['POST /search/metadata', static fn (ImmichClient $client, Connection $connection) => $client->search($connection, []), 'asset.read'],
			'the number' => ['POST /search/statistics', static fn (ImmichClient $client, Connection $connection) => $client->statistics($connection, []), 'asset.statistics'],
			'the account' => ['GET /users/me', static fn (ImmichClient $client, Connection $connection) => $client->userName($connection), 'user.read'],
			'a preview' => ['GET /assets/' . self::ASSET . '/thumbnail', static fn (ImmichClient $client, Connection $connection) => $client->thumbnail($connection, self::ASSET, 'thumbnail'), 'asset.view'],
		];
	}

	// spec: IMMICH-001.9
	/** @param \Closure(ImmichClient, Connection): mixed $call */
	#[DataProvider('scopedCalls')]
	public function testAForbiddenCallNamesTheScopeItNeeded(string $route, \Closure $call, string $scope): void {
		$this->immichAnswers($route, 403, ['message' => 'Missing required permission: ' . $scope]);

		$failure = $this->assertFailsWith(ImmichError::Scope, fn (): mixed => $call($this->client(), $this->connection()));
		$this->assertSame($scope, $failure->scope);
		$this->assertCount(1, $this->immichRequests);
	}

	public function testTheAccountAndTheNumberOfUploadsAreRead(): void {
		$this->immichAnswers('GET /users/me', 200, ['id' => 'u', 'name' => 'Alice', 'email' => 'a@example.org']);
		$this->immichAnswers('POST /search/statistics', 200, ['total' => 3660]);

		$this->assertSame('Alice', $this->client()->userName($this->connection()));
		$this->assertSame(3660, $this->client()->statistics($this->connection(), ['type' => ['eq' => 'IMAGE']]));
		$this->assertSame(['filter' => ['type' => ['eq' => 'IMAGE']]], $this->lastImmichBody('POST /search/statistics'));
	}

	public function testAPreviewAnswersImmichsBytesAndContentType(): void {
		$this->immichRoute('GET /assets/' . self::ASSET . '/thumbnail', static fn (array $options): array => [200, 'webp of ' . json_encode($options['query'] ?? null, JSON_THROW_ON_ERROR), 'image/webp']);

		$image = $this->client()->thumbnail($this->connection(), self::ASSET, 'preview');

		$this->assertSame(['body' => 'webp of {"size":"preview"}', 'type' => 'image/webp'], $image);
	}

	// spec: IMMICH-002.20
	public function testAPreviewImmichDoesNotKnowIsAnUnknownAsset(): void {
		foreach ([404, 400] as $status) {
			$this->immichAnswers('GET /assets/' . self::ASSET . '/thumbnail', $status, ['message' => 'Not found or no asset.view access']);

			$this->assertFailsWith(ImmichError::UnknownAsset, fn () => $this->client()->thumbnail($this->connection(), self::ASSET, 'thumbnail'));
		}
	}

	private function client(): ImmichClient {
		return new ImmichClient($this->immichClients(), $this->files, $this->logger);
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', self::KEY_FILE, false);
	}
}
