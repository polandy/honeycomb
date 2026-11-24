<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\Reason;
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

	/** The value stored under the key, decoded; a method so psalm does not narrow the property. */
	private function storedValue(string $key): mixed {
		return json_decode($this->stored["alice/honeycomb/$key"] ?? 'null', true);
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
		$this->expectException(InvalidRequestException::class);

		$this->service()->save($this->user(), $settings);
	}

	// spec: SETTINGS-001.4
	public function testRefusesSettingsOverTheSizeLimit(): void {
		$service = $this->service();

		$this->assertSame(Reason::TooLarge, ReasonOf::call(fn () => $service->save($this->user(), ['note' => str_repeat('x', SettingsService::MAX_BYTES)])));
		$this->assertSame([], $this->stored);
	}

	// spec: SETTINGS-001.4
	public function testAcceptsSettingsAtTheSizeLimit(): void {
		$settings = ['note' => str_repeat('x', SettingsService::MAX_BYTES - strlen('{"note":""}'))];

		$this->service()->save($this->user(), $settings);

		$this->assertSame(SettingsService::MAX_BYTES, strlen($this->stored['alice/honeycomb/settings']));
	}

	// spec: SETTINGS-001.2
	public function testTheObjectIsStoredWithoutTheLists(): void {
		$this->service()->save($this->user(), ['viKeys' => true, 'moveRecent' => ['/A'], 'moveFavourites' => ['/B'], 'libraryRoots' => ['/C']]);

		$this->assertSame(['alice/honeycomb/settings' => '{"viKeys":true}'], $this->stored);
	}

	// spec: SETTINGS-001.31
	public function testAListIsStoredUnderItsOwnKeyAndReadInTheObject(): void {
		$service = $this->service();
		$service->save($this->user(), ['viKeys' => true]);

		$saved = $service->saveList($this->user(), 'moveRecent', ['/B', '/A']);
		$service->saveList($this->user(), 'moveFavourites', []);
		$service->saveList($this->user(), 'libraryRoots', ['/Photos']);

		$this->assertSame(['/B', '/A'], $saved);
		$this->assertSame(['/B', '/A'], $this->storedValue('move_recent'));
		$this->assertEquals((object)['viKeys' => true, 'moveRecent' => ['/B', '/A'], 'moveFavourites' => [], 'libraryRoots' => ['/Photos']], $service->get($this->user()));
	}

	// spec: SETTINGS-001.31
	public function testSavingTheObjectKeepsTheListsOfAnotherTab(): void {
		$service = $this->service();
		$service->saveList($this->user(), 'moveRecent', ['/New']);

		$service->save($this->user(), ['viKeys' => true, 'moveRecent' => ['/Old']]);

		$this->assertSame(['/New'], $service->get($this->user())->moveRecent);
	}

	/** @return array<string, array{string, mixed, Reason}> */
	public static function invalidLists(): array {
		return [
			'an unknown name' => ['moveTemplate', ['/A'], Reason::UnknownName],
			'an object' => ['moveRecent', ['a' => '/A'], Reason::NotAList],
			'a number in it' => ['moveRecent', ['/A', 3], Reason::NotAList],
			'a string' => ['libraryRoots', '/A', Reason::NotAList],
			'null' => ['moveFavourites', null, Reason::NotAList],
			'over the size limit' => ['moveRecent', [str_repeat('x', SettingsService::MAX_BYTES)], Reason::TooLarge],
		];
	}

	// spec: SETTINGS-001.31
	#[DataProvider('invalidLists')]
	public function testRefusesAnythingButAKnownListOfStrings(string $name, mixed $items, Reason $reason): void {
		$this->assertSame($reason, ReasonOf::call(fn () => $this->service()->saveList($this->user(), $name, $items)));
		$this->assertSame([], $this->stored);
	}

	// spec: SETTINGS-001.31
	public function testAcceptsAListAtTheSizeLimit(): void {
		$this->service()->saveList($this->user(), 'moveRecent', [str_repeat('x', SettingsService::MAX_BYTES - strlen('[""]'))]);

		$this->assertSame(SettingsService::MAX_BYTES, strlen($this->stored['alice/honeycomb/move_recent']));
	}

	// spec: SETTINGS-001.32
	public function testAListStillInTheObjectIsReadAndCarriedOverOnTheNextSave(): void {
		$this->stored['alice/honeycomb/settings'] = '{"viKeys":true,"moveRecent":["/A"],"libraryRoots":["/Photos"]}';
		$this->stored['alice/honeycomb/library_roots'] = '["/Phone"]';
		$service = $this->service();

		$read = $service->get($this->user());
		$service->save($this->user(), ['viKeys' => false]);

		$this->assertEquals((object)['viKeys' => true, 'moveRecent' => ['/A'], 'libraryRoots' => ['/Phone']], $read);
		$this->assertSame(['viKeys' => false], $this->storedValue('settings'));
		$this->assertSame(['/A'], $this->storedValue('move_recent'));
		$this->assertSame(['/Phone'], $this->storedValue('library_roots'));
		$this->assertNull($this->storedValue('move_favourites'));
	}

	// spec: SETTINGS-001.3
	public function testABrokenStoredListReadsAsEmpty(): void {
		$this->stored['alice/honeycomb/move_recent'] = '{"a":1}';

		$this->assertSame([], $this->service()->get($this->user())->moveRecent);
	}
}
