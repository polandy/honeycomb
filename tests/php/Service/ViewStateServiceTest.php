<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Service\ViewStateService;
use OCP\Config\IUserConfig;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ViewStateServiceTest extends TestCase {
	/** @var array<string, mixed> */
	private array $stored = [];

	private function service(): ViewStateService {
		$config = $this->createStub(IUserConfig::class);
		$config->method('hasKey')->willReturnCallback(
			fn (string $userId, string $app, string $key): bool => isset($this->stored["$userId/$app/$key"]),
		);
		$config->method('getValueBool')->willReturnCallback(
			fn (string $userId, string $app, string $key, bool $default = false): bool => (bool)($this->stored["$userId/$app/$key"] ?? $default),
		);
		$config->method('getValueInt')->willReturnCallback(
			fn (string $userId, string $app, string $key, int $default = 0): int => (int)($this->stored["$userId/$app/$key"] ?? $default),
		);
		$config->method('getValueArray')->willReturnCallback(
			fn (string $userId, string $app, string $key, array $default = []): array => (array)($this->stored["$userId/$app/$key"] ?? $default),
		);
		$config->method('setValueArray')->willReturnCallback(
			function (string $userId, string $app, string $key, array $value): bool {
				$this->stored["$userId/$app/$key"] = $value;
				return true;
			},
		);
		$config->method('setValueInt')->willReturnCallback(
			function (string $userId, string $app, string $key, int $value): bool {
				$this->stored["$userId/$app/$key"] = $value;
				return true;
			},
		);
		$config->method('setValueBool')->willReturnCallback(
			function (string $userId, string $app, string $key, bool $value): bool {
				$this->stored["$userId/$app/$key"] = $value;
				return true;
			},
		);
		return new ViewStateService($config);
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	// spec: LOUPE-003.1
	public function testAKeyNeverStoredIsNull(): void {
		$this->assertSame(['info_panel_open' => null, 'gesture_guide_seen' => null, 'series_hint_seen' => null, 'reject_hint_seen' => null, 'year_review_hint_closed' => null, 'immich_filters' => null], $this->service()->get($this->user()));
	}

	// spec: LOUPE-003.1
	public function testReadsEachStoredBoolean(): void {
		$this->stored['alice/honeycomb/info_panel_open'] = false;
		$this->stored['alice/honeycomb/gesture_guide_seen'] = true;

		$this->assertSame(['info_panel_open' => false, 'gesture_guide_seen' => true, 'series_hint_seen' => null, 'reject_hint_seen' => null, 'year_review_hint_closed' => null, 'immich_filters' => null], $this->service()->get($this->user()));
	}

	// spec: LOUPE-003.2
	public function testStoresOnlyTheKeysGivenAndAnswersTheFullViewState(): void {
		$this->stored['alice/honeycomb/info_panel_open'] = true;

		$answer = $this->service()->save($this->user(), ['gesture_guide_seen' => false]);

		$this->assertSame(['info_panel_open' => true, 'gesture_guide_seen' => false, 'series_hint_seen' => null, 'reject_hint_seen' => null, 'year_review_hint_closed' => null, 'immich_filters' => null], $answer);
		$this->assertSame(['alice/honeycomb/info_panel_open' => true, 'alice/honeycomb/gesture_guide_seen' => false], $this->stored);
	}

	// spec: LOUPE-003.2
	public function testStoresEveryKey(): void {
		$answer = $this->service()->save($this->user(), ['info_panel_open' => true, 'gesture_guide_seen' => true, 'series_hint_seen' => true, 'reject_hint_seen' => true, 'year_review_hint_closed' => 2026, 'immich_filters' => ['phone' => ['time' => 'all']]]);

		$this->assertEquals(['info_panel_open' => true, 'gesture_guide_seen' => true, 'series_hint_seen' => true, 'reject_hint_seen' => true, 'year_review_hint_closed' => 2026, 'immich_filters' => (object)['phone' => ['time' => 'all']]], $answer);
	}

	// spec: LOUPE-003.1
	public function testReadsTheYearOfTheClosedHint(): void {
		$this->stored['alice/honeycomb/year_review_hint_closed'] = 2025;

		$this->assertSame(2025, $this->service()->get($this->user())['year_review_hint_closed']);
	}

	/** @return array<string, array{mixed}> */
	public static function invalidViewStates(): array {
		return [
			'null' => [null],
			'a string' => ['info_panel_open'],
			'a list' => [[true]],
			'an empty object' => [[]],
			'an unknown key' => [['info_panel_open' => true, 'tileSize' => true]],
			'a string value' => [['info_panel_open' => 'true']],
			'a number value' => [['gesture_guide_seen' => 1]],
			'a null value' => [['gesture_guide_seen' => null]],
			'a boolean year' => [['year_review_hint_closed' => true]],
			'a year as text' => [['year_review_hint_closed' => '2026']],
			'a year before 1970' => [['year_review_hint_closed' => 1969]],
			'a year after 9999' => [['year_review_hint_closed' => 10000]],
			'a flag with a year' => [['info_panel_open' => 2026]],
			'Immich filters of a connection id outside the connections file\'s' => [['immich_filters' => ['Phone 1' => ['time' => 'all']]]],
			'Immich filters without a connection' => [['immich_filters' => []]],
			'Immich filters as text' => [['immich_filters' => 'all']],
			'Immich filters of a list' => [['immich_filters' => ['phone' => ['all']]]],
			'Immich filters as text per connection' => [['immich_filters' => ['phone' => 'all']]],
			'Immich filters of a too long connection id' => [['immich_filters' => [str_repeat('a', 65) => ['time' => 'all']]]],
			'Immich filters over 4096 bytes' => [['immich_filters' => ['phone' => ['devices' => [str_repeat('a', 4096)]]]]],
		];
	}

	// spec: LOUPE-003.3
	#[DataProvider('invalidViewStates')]
	public function testRefusesAnythingButAnObjectOfKnownBooleans(mixed $viewState): void {
		$service = $this->service();

		try {
			$service->save($this->user(), $viewState);
			$this->fail('expected InvalidRequestException');
		} catch (InvalidRequestException) {
			$this->assertSame([], $this->stored);
		}
	}

	// spec: LOUPE-003.10
	public function testMergesTheImmichFiltersOfTheConnectionsGiven(): void {
		$this->storeImmichFilters(['phone' => ['time' => 'all'], 'tablet' => ['kinds' => ['video']]]);

		$answer = $this->service()->save($this->user(), ['immich_filters' => ['tablet' => ['time' => 'current'], 'camera' => []]]);

		$expected = ['phone' => ['time' => 'all'], 'tablet' => ['time' => 'current'], 'camera' => []];
		$this->assertEquals((object)$expected, $answer['immich_filters']);
		$this->assertSame($expected, $this->stored['alice/honeycomb/immich_filters']);
	}

	/** Seeds alice's stored Immich filters outside the test, so psalm does not narrow the store to them. */
	private function storeImmichFilters(array $filters): void {
		$this->stored['alice/honeycomb/immich_filters'] = $filters;
	}

	// spec: LOUPE-003.10
	public function testKeepsTheFiltersOfANumericConnectionIdAndAnswersThemAsAnObject(): void {
		$answer = $this->service()->save($this->user(), ['immich_filters' => ['0' => ['time' => 'all']]]);

		$this->assertSame('{"0":{"time":"all"}}', json_encode($answer['immich_filters']));
	}

	// spec: LOUPE-003.10
	public function testRefusesImmichFiltersOfMoreThanFiftyConnections(): void {
		$this->stored['alice/honeycomb/immich_filters'] = array_fill_keys(array_map(fn (int $at): string => "c$at", range(1, 50)), []);
		$stored = $this->stored;

		try {
			$this->service()->save($this->user(), ['immich_filters' => ['c51' => []]]);
			$this->fail('expected InvalidRequestException');
		} catch (InvalidRequestException) {
			$this->assertSame($stored, $this->stored);
		}
	}
}
