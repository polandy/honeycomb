<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\Connections;
use OCA\Honeycomb\Immich\ConnectionsFileShape;
use OCA\Honeycomb\Immich\ImmichError;
use OCP\IAppConfig;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ConnectionsTest extends TestCase {
	use AssertsImmichFailure;

	private const string PATH = '/run/secrets/honeycomb/connections.json';

	private FakeLocalFiles $files;
	private FakeLogger $logger;
	private string $configured = self::PATH;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeLocalFiles();
		$this->logger = new FakeLogger();
		$this->files->files[self::PATH] = $this->file([
			$this->entry('alice-phone', 'alice', ['label' => 'My phone']),
			$this->entry('bob-phone', 'bob'),
			$this->entry('alice-camera', 'alice', ['url' => 'https://immich.example.org:2283/', 'picksAsFavorites' => true]),
		]);
	}

	// spec: IMMICH-001.1
	public function testWithoutTheAppConfigTheSourceIsNotConfiguredAndNothingIsLogged(): void {
		$this->configured = '';

		$this->assertFailsWith(ImmichError::NotConfigured, fn () => $this->connections()->forUser('alice'));
		$this->assertSame([], $this->logger->lines);
		$this->assertSame([], $this->files->reads);
	}

	// spec: IMMICH-001.2
	public function testAUserSeesTheirOwnConnectionsInFileOrderWithoutKeyOrKeyFile(): void {
		$listed = array_map(static fn ($connection): array => $connection->toArray(), $this->connections()->forUser('alice'));

		$this->assertSame([
			['id' => 'alice-phone', 'label' => 'My phone', 'url' => 'http://immich-server:2283', 'picksAsFavorites' => false],
			['id' => 'alice-camera', 'label' => 'Phone', 'url' => 'https://immich.example.org:2283', 'picksAsFavorites' => true],
		], $listed);
	}

	// spec: IMMICH-001.2
	public function testAUserWithoutConnectionsGetsNone(): void {
		$this->assertSame([], $this->connections()->forUser('carol'));
	}

	public function testAConnectionCarriesItsKeyFileAndFavouriteChoiceForTheServer(): void {
		$camera = $this->connections()->find('alice', 'alice-camera');

		$this->assertSame('/run/secrets/honeycomb/alice-camera.key', $camera->keyFile);
		$this->assertTrue($camera->picksAsFavorites);
		$this->assertFalse($this->connections()->find('alice', 'alice-phone')->picksAsFavorites);
	}

	/** @return array<string, array{string, string}> */
	public static function badFiles(): array {
		$good = ['id' => 'x', 'user' => 'alice', 'label' => 'Phone', 'url' => 'http://immich:2283', 'keyFile' => '/k'];
		$file = static fn (array $connections, int $version = 1): string => json_encode(['version' => $version, 'connections' => $connections], JSON_THROW_ON_ERROR);
		return [
			'not JSON' => ['{', 'is not JSON'],
			'not an object' => ['[]', 'is not an object'],
			'other version' => [$file([$good], 2), 'version must be 1'],
			'unknown top field' => ['{"version":1,"connections":[],"extra":1}', 'unknown field extra'],
			'connections not a list' => ['{"version":1,"connections":{}}', 'connections must be a list'],
			'unknown field' => [$file([array_replace($good, ['apiKey' => 'secret'])]), 'connections[0]: unknown field apiKey'],
			'missing field' => [$file([array_diff_key($good, ['label' => true])]), 'connections[0]: label is missing'],
			'wrong type' => [$file([array_replace($good, ['picksAsFavorites' => 'yes'])]), 'connections[0]: picksAsFavorites must be a boolean'],
			'empty label' => [$file([array_replace($good, ['label' => ''])]), 'connections[0]: label must be a non-empty string'],
			'duplicate id' => [$file([$good, array_replace($good, ['user' => 'bob'])]), 'connections[1]: id x is not unique'],
			'id with capitals' => [$file([array_replace($good, ['id' => 'Alice'])]), 'connections[0]: id must be 1 to 64 of a-z, 0-9 and -'],
			'id too long' => [$file([array_replace($good, ['id' => str_repeat('a', 65)])]), 'connections[0]: id must be 1 to 64 of a-z, 0-9 and -'],
			'url with a path' => [$file([array_replace($good, ['url' => 'http://immich:2283/api'])]), 'connections[0]: url must be an http or https origin'],
			'url with a query' => [$file([array_replace($good, ['url' => 'http://immich:2283?x=1'])]), 'connections[0]: url must be an http or https origin'],
			'url of another scheme' => [$file([array_replace($good, ['url' => 'ftp://immich'])]), 'connections[0]: url must be an http or https origin'],
			'relative key file' => [$file([array_replace($good, ['keyFile' => 'keys/x.key'])]), 'connections[0]: keyFile must be an absolute path'],
			'an entry not an object' => [$file(['x']), 'connections[0] is not an object'],
		];
	}

	// spec: IMMICH-001.3
	#[DataProvider('badFiles')]
	public function testOneBadEntryInvalidatesTheFileForEveryUserWithOneLogLine(string $content, string $violation): void {
		$this->files->files[self::PATH] = $content;

		foreach (['alice', 'bob'] as $user) {
			$failure = $this->assertFailsWith(ImmichError::ConnectionsFile, fn () => $this->connections()->forUser($user));
			$this->assertStringNotContainsString(self::PATH, $failure->getMessage());
			$this->assertStringNotContainsString($violation, $failure->getMessage());
		}
		$this->assertCount(2, $this->logger->lines);
		$this->assertSame('error', $this->logger->lines[0]['level']);
		$this->assertStringNotContainsString(self::PATH, $this->logger->lines[0]['line']);
		$this->assertStringContainsString($violation, $this->logger->lines[0]['line']);
	}

	// spec: IMMICH-001.4
	public function testAMissingFileIsTheConnectionsFileStateLoggedWithoutItsPath(): void {
		unset($this->files->files[self::PATH]);

		$this->assertFailsWith(ImmichError::ConnectionsFile, fn () => $this->connections()->forUser('alice'));
		$this->assertCount(1, $this->logger->lines);
		$this->assertStringContainsString('cannot be read', $this->logger->lines[0]['line']);
		$this->assertStringNotContainsString(self::PATH, $this->logger->lines[0]['line']);
	}

	// spec: IMMICH-001.5
	public function testAnotherUsersOrAnUnknownConnectionIsUnknownBeforeAnyKeyIsRead(): void {
		$this->assertFailsWith(ImmichError::UnknownConnection, fn () => $this->connections()->find('alice', 'bob-phone'));
		$this->assertFailsWith(ImmichError::UnknownConnection, fn () => $this->connections()->find('alice', 'nobody'));
		$this->assertSame([self::PATH, self::PATH], $this->files->reads);
	}

	// spec: IMMICH-001.12
	public function testEveryRequestReadsTheFileAgain(): void {
		$connections = $this->connections();
		$this->assertCount(2, $connections->forUser('alice'));

		$this->files->files[self::PATH] = $this->file([$this->entry('alice-tablet', 'alice')]);

		$this->assertSame(['alice-tablet'], array_map(static fn ($connection): string => $connection->id, $connections->forUser('alice')));
	}

	private function connections(): Connections {
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(fn (string $app, string $key): string => $app === 'honeycomb' && $key === 'connections_file' ? $this->configured : '');
		return new Connections($config, $this->files, new ConnectionsFileShape(), $this->logger);
	}

	/**
	 * @param array<string, mixed> $override
	 * @return array<string, mixed>
	 */
	private function entry(string $id, string $user, array $override = []): array {
		return [...['id' => $id, 'user' => $user, 'label' => 'Phone', 'url' => 'http://immich-server:2283', 'keyFile' => "/run/secrets/honeycomb/$id.key"], ...$override];
	}

	/** @param list<array<string, mixed>> $connections */
	private function file(array $connections): string {
		return json_encode(['version' => 1, 'connections' => $connections], JSON_THROW_ON_ERROR);
	}
}
