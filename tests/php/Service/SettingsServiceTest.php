<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidSettingsException;
use OCA\Honeycomb\Service\SettingsService;
use OCP\Config\IUserConfig;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

final class SettingsServiceTest extends TestCase {
	/** @var array<string, string> */
	private array $stored = [];

	private function service(): SettingsService {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(
			fn (string $userId, string $app, string $key, string $default = ''): string => $this->stored["$userId/$app/$key"] ?? $default,
		);
		$config->method('setValueString')->willReturnCallback(
			function (string $userId, string $app, string $key, string $value): bool {
				$this->stored["$userId/$app/$key"] = $value;
				return true;
			},
		);
		return new SettingsService($config);
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	// spec: SETTINGS-001.1
	public function testNothingStoredIsAnEmptyObject(): void {
		$this->assertEquals(new stdClass(), $this->service()->get($this->user()));
	}

	// spec: SETTINGS-001.2
	public function testStoresTheObjectAsJsonUnderTheSettingsKey(): void {
		$service = $this->service();

		$service->save($this->user(), ['viKeys' => true, 'rawExtensions' => ['nef']]);

		$this->assertSame('{"viKeys":true,"rawExtensions":["nef"]}', $this->stored['alice/honeycomb/settings']);
		$this->assertSame('{"viKeys":true,"rawExtensions":["nef"]}', json_encode($service->get($this->user())));
	}

	// spec: SETTINGS-001.2
	public function testAnEmptyObjectIsStoredAsAnObject(): void {
		$service = $this->service();

		$service->save($this->user(), []);

		$this->assertSame('{}', $this->stored['alice/honeycomb/settings']);
	}

	// spec: SETTINGS-001.3
	public function testCorruptStoredJsonReadsAsAnEmptyObject(): void {
		$this->stored['alice/honeycomb/settings'] = '{"viKeys":';

		$this->assertEquals(new stdClass(), $this->service()->get($this->user()));
	}

	// spec: SETTINGS-001.3
	public function testAStoredListReadsAsAnEmptyObject(): void {
		$this->stored['alice/honeycomb/settings'] = '[1,2]';

		$this->assertEquals(new stdClass(), $this->service()->get($this->user()));
	}

	/** @return array<string, array{mixed}> */
	public static function invalidSettings(): array {
		return ['a list' => [[1, 2]], 'a string' => ['viKeys'], 'a number' => [3], 'null' => [null]];
	}

	// spec: SETTINGS-001.4
	#[DataProvider('invalidSettings')]
	public function testRefusesSettingsThatAreNotAnObject(mixed $settings): void {
		$this->expectException(InvalidSettingsException::class);

		$this->service()->save($this->user(), $settings);
	}

	// spec: SETTINGS-001.4
	public function testRefusesSettingsOverTheSizeLimit(): void {
		$service = $this->service();

		try {
			$service->save($this->user(), ['note' => str_repeat('x', SettingsService::MAX_BYTES)]);
			$this->fail('expected InvalidSettingsException');
		} catch (InvalidSettingsException) {
			$this->assertSame([], $this->stored);
		}
	}

	// spec: SETTINGS-001.4
	public function testAcceptsSettingsAtTheSizeLimit(): void {
		$settings = ['note' => str_repeat('x', SettingsService::MAX_BYTES - strlen('{"note":""}'))];

		$this->service()->save($this->user(), $settings);

		$this->assertSame(SettingsService::MAX_BYTES, strlen($this->stored['alice/honeycomb/settings']));
	}
}
