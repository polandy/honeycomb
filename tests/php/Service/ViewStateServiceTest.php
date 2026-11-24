<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\ViewStateService;
use OCP\Config\IUserConfig;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ViewStateServiceTest extends TestCase {
	/** @var array<string, bool|int> */
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
		$this->assertSame(['info_panel_open' => null, 'gesture_guide_seen' => null, 'series_hint_seen' => null, 'reject_hint_seen' => null, 'year_review_hint_closed' => null], $this->service()->get($this->user()));
	}

	// spec: LOUPE-003.1
	public function testReadsEachStoredBoolean(): void {
		$this->stored['alice/honeycomb/info_panel_open'] = false;
		$this->stored['alice/honeycomb/gesture_guide_seen'] = true;

		$this->assertSame(['info_panel_open' => false, 'gesture_guide_seen' => true, 'series_hint_seen' => null, 'reject_hint_seen' => null, 'year_review_hint_closed' => null], $this->service()->get($this->user()));
	}

	// spec: LOUPE-003.2
	public function testStoresOnlyTheKeysGivenAndAnswersTheFullViewState(): void {
		$this->stored['alice/honeycomb/info_panel_open'] = true;

		$answer = $this->service()->save($this->user(), ['gesture_guide_seen' => false]);

		$this->assertSame(['info_panel_open' => true, 'gesture_guide_seen' => false, 'series_hint_seen' => null, 'reject_hint_seen' => null, 'year_review_hint_closed' => null], $answer);
		$this->assertSame(['alice/honeycomb/info_panel_open' => true, 'alice/honeycomb/gesture_guide_seen' => false], $this->stored);
	}

	// spec: LOUPE-003.2
	public function testStoresEveryKey(): void {
		$answer = $this->service()->save($this->user(), ['info_panel_open' => true, 'gesture_guide_seen' => true, 'series_hint_seen' => true, 'reject_hint_seen' => true, 'year_review_hint_closed' => 2026]);

		$this->assertSame(['info_panel_open' => true, 'gesture_guide_seen' => true, 'series_hint_seen' => true, 'reject_hint_seen' => true, 'year_review_hint_closed' => 2026], $answer);
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
}
