<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\Connections;
use OCA\Honeycomb\Immich\ConnectionsFileShape;
use OCA\Honeycomb\Immich\ImmichConnectionSweep;
use OCA\Honeycomb\Immich\ImmichPosition;
use OCP\IAppConfig;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichConnectionSweepTest extends TestCase {
	private const string PATH = '/run/secrets/honeycomb/connections.json';
	private const string ASSET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

	private FakeLocalFiles $files;
	private FakeImmichDecisionStore $store;
	private FakeImmichPositionStore $positions;
	private string $configured = self::PATH;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeLocalFiles();
		$this->files->files[self::PATH] = json_encode(['version' => 1, 'connections' => [
			$this->entry('alice-phone', 'alice'),
			$this->entry('handed-over', 'bob'),
		]], JSON_THROW_ON_ERROR);
		$this->store = new FakeImmichDecisionStore();
		$this->decide('alice', 'alice-phone');
		$this->decide('alice', 'alice-removed');
		$this->decide('alice', 'handed-over');
		$this->positions = new FakeImmichPositionStore();
		foreach (['alice-phone', 'alice-removed', 'handed-over'] as $connectionId) {
			$this->positions->save('alice', new ImmichPosition($connectionId, self::ASSET, 1_795_000_000, 1, 2, 1_795_000_000));
		}
	}

	// spec: IMMICH-003.10
	public function testRowsOfAConnectionTheFileNoLongerNamesForTheirUserAreRemoved(): void {
		$this->assertSame(2, $this->sweep()->sweep());

		$this->assertSame(['alice-phone/' . self::ASSET], array_keys($this->store->rows));
	}

	// spec: IMMICH-003.18
	public function testThePositionOfAConnectionTheFileNoLongerNamesForItsUserGoesWithItsRows(): void {
		$this->sweep()->sweep();

		$this->assertSame(['alice-phone'], array_keys($this->positions->rows['alice']));
	}

	/** @return array<string, array{string, ?string}> */
	public static function brokenFiles(): array {
		return [
			'not configured' => ['', null],
			'missing' => [self::PATH . '.gone', null],
			'invalid' => [self::PATH, '{"version": 1, "connections": [{"id": "x"}]}'],
		];
	}

	// spec: IMMICH-003.11
	#[DataProvider('brokenFiles')]
	public function testABrokenFileSweepsNothing(string $configured, ?string $content): void {
		$this->configured = $configured;
		if ($content !== null) {
			$this->files->files[self::PATH] = $content;
		}

		$this->assertSame(0, $this->sweep()->sweep());

		$this->assertCount(3, $this->store->rows);
		$this->assertCount(3, $this->positions->rows['alice']);
	}

	private function sweep(): ImmichConnectionSweep {
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(fn (string $app, string $key): string => $app === 'honeycomb' && $key === 'connections_file' ? $this->configured : '');
		return new ImmichConnectionSweep(new Connections($config, $this->files, new ConnectionsFileShape(), new FakeLogger()), $this->store, $this->positions);
	}

	private function decide(string $userId, string $connectionId): void {
		$this->store->decide($userId, $connectionId, new AssetDecision(self::ASSET, 1, null, Flag::Picked, false, 1_795_000_000, null, AssetKind::Photo, 'x'));
	}

	/** @return array<string, string> */
	private function entry(string $id, string $user): array {
		return ['id' => $id, 'user' => $user, 'label' => 'Phone', 'url' => 'http://immich-server:2283', 'keyFile' => "/run/secrets/honeycomb/$id.key"];
	}
}
