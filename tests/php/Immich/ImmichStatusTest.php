<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ImmichStatus;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichStatusTest extends TestCase {
	use FakeImmichServer;

	private FakeLocalFiles $files;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeLocalFiles();
		$this->files->files['/keys/good.key'] = 'good';
		$this->immichAnswers('GET /server/version', 200, ['major' => 3, 'minor' => 4, 'patch' => 2, 'prerelease' => null, 'featureLevel' => 0]);
		$this->immichAnswers('POST /search/metadata', 200, ['albums' => [], 'assets' => ['count' => 0, 'facets' => [], 'items' => [], 'nextCursor' => null, 'nextPage' => null, 'total' => 0]]);
		$this->immichAnswers('GET /users/me', 200, ['id' => 'u', 'name' => 'Alice']);
		$this->immichAnswers('POST /search/statistics', 200, ['total' => 3660]);
	}

	public function testAGoodConnectionIsOkWithItsAccountVersionAndNumberOfUploads(): void {
		$this->assertSame(['state' => 'ok', 'account' => 'Alice', 'version' => '3.4.2', 'total' => 3660], $this->statusOf($this->connection('good')));
		$this->assertSame(['filter' => (new ImmichSearchFilter())->uploads()], $this->lastImmichBody('POST /search/statistics'));
	}

	// spec: IMMICH-001.7
	public function testABadKeyFileMakesOnlyItsConnectionUnusable(): void {
		$this->assertSame(['state' => 'key', 'account' => null, 'version' => '3.4.2', 'total' => null], $this->statusOf($this->connection('missing')));
		$this->assertSame('ok', $this->statusOf($this->connection('good'))['state']);
	}

	/** @return array<string, array{\Closure(self): void, string}> */
	public static function failedConnections(): array {
		return [
			'Immich down' => [static fn (self $test) => $test->immichDown('GET /server/version'), 'unreachable'],
			'the search down' => [static fn (self $test) => $test->immichDown('POST /search/metadata'), 'unreachable'],
			'the key refused' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 401), 'refused'],
			'no asset.read' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 403), 'scope'],
			'a search answer that does not fit' => [static fn (self $test) => $test->immichAnswers('POST /search/metadata', 400), 'version'],
			'a version answer that does not fit' => [static fn (self $test) => $test->immichAnswers('GET /server/version', 200, ['major' => '3']), 'version'],
			'the account route failing' => [static fn (self $test) => $test->immichAnswers('GET /users/me', 502), 'unreachable'],
			'the statistics failing' => [static fn (self $test) => $test->immichAnswers('POST /search/statistics', 418), 'version'],
		];
	}

	// spec: IMMICH-001.8, IMMICH-001.16
	/** @param \Closure(self): void $answer */
	#[DataProvider('failedConnections')]
	public function testAFailedCallIsTheConnectionsStateAndTheStatusStillAnswers(\Closure $answer, string $state): void {
		$answer($this);

		$status = $this->statusOf($this->connection('good'));

		$this->assertSame($state, $status['state']);
		$this->assertNull($status['account']);
		$this->assertNull($status['total']);
	}

	// spec: IMMICH-001.10
	public function testWithoutUserReadTheAccountIsUnknownAndTheConnectionWorks(): void {
		$this->immichAnswers('GET /users/me', 403);

		$this->assertSame(['state' => 'ok', 'account' => null, 'version' => '3.4.2', 'total' => 3660], $this->statusOf($this->connection('good')));
	}

	// spec: IMMICH-001.17
	public function testWithoutAssetStatisticsTheNumberIsUnknownAndTheConnectionWorks(): void {
		$this->immichAnswers('POST /search/statistics', 403);

		$this->assertSame(['state' => 'ok', 'account' => 'Alice', 'version' => '3.4.2', 'total' => null], $this->statusOf($this->connection('good')));
	}

	/** @return array<string, array{int, int, string}> */
	public static function unsupportedVersions(): array {
		return ['an older major' => [2, 9, '2.9.0'], 'a 3.x before the search filter' => [3, 1, '3.1.0'], 'a later major' => [4, 0, '4.0.0']];
	}

	// spec: IMMICH-001.11
	#[DataProvider('unsupportedVersions')]
	public function testAnotherVersionIsTheVersionStateAndNamesTheVersion(int $major, int $minor, string $version): void {
		$this->immichAnswers('GET /server/version', 200, ['major' => $major, 'minor' => $minor, 'patch' => 0, 'prerelease' => null, 'featureLevel' => 0]);

		$this->assertSame(['state' => 'version', 'account' => null, 'version' => $version, 'total' => null], $this->statusOf($this->connection('good')));
		$this->assertCount(1, $this->immichRequests);
	}

	// spec: IMMICH-001.11
	public function testAVersionTheKeyMayNotReadIsUnknownAndTheConnectionWorks(): void {
		$this->immichAnswers('GET /server/version', 401);

		$this->assertSame(['state' => 'ok', 'account' => 'Alice', 'version' => null, 'total' => 3660], $this->statusOf($this->connection('good')));
	}

	public function testTheEarliestSupportedVersionIsOk(): void {
		$this->immichAnswers('GET /server/version', 200, ['major' => 3, 'minor' => 2, 'patch' => 0, 'prerelease' => null, 'featureLevel' => 0]);

		$this->assertSame('ok', $this->statusOf($this->connection('good'))['state']);
	}

	/** @return array{state: string, account: ?string, version: ?string, total: ?int} */
	private function statusOf(Connection $connection): array {
		return (new ImmichStatus(new ImmichClient($this->immichClients(), $this->files, new FakeLogger()), new ImmichSearchFilter()))->of($connection);
	}

	private function connection(string $key): Connection {
		return new Connection("alice-$key", 'alice', 'Phone', 'http://immich-server:2283', "/keys/$key.key", false);
	}
}
