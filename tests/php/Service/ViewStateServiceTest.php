<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidViewStateException;
use OCA\Honeycomb\Service\ViewStateService;
use OCP\Config\IUserConfig;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ViewStateServiceTest extends TestCase {
	/** @var array<string, bool> */
	private array $stored = [];

	private function service(): ViewStateService {
		$config = $this->createStub(IUserConfig::class);
		$config->method('hasKey')->willReturnCallback(
			fn (string $userId, string $app, string $key): bool => isset($this->stored["$userId/$app/$key"]),
		);
		$config->method('getValueBool')->willReturnCallback(
			fn (string $userId, string $app, string $key, bool $default = false): bool => $this->stored["$userId/$app/$key"] ?? $default,
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
		$this->assertSame(['infoPanelOpen' => null, 'gestureGuideSeen' => null], $this->service()->get($this->user()));
	}

	// spec: LOUPE-003.1
	public function testReadsEachStoredBoolean(): void {
		$this->stored['alice/honeycomb/infoPanelOpen'] = false;
		$this->stored['alice/honeycomb/gestureGuideSeen'] = true;

		$this->assertSame(['infoPanelOpen' => false, 'gestureGuideSeen' => true], $this->service()->get($this->user()));
	}

	// spec: LOUPE-003.2
	public function testStoresOnlyTheKeysGivenAndAnswersTheFullViewState(): void {
		$this->stored['alice/honeycomb/infoPanelOpen'] = true;

		$answer = $this->service()->save($this->user(), ['gestureGuideSeen' => false]);

		$this->assertSame(['infoPanelOpen' => true, 'gestureGuideSeen' => false], $answer);
		$this->assertSame(['alice/honeycomb/infoPanelOpen' => true, 'alice/honeycomb/gestureGuideSeen' => false], $this->stored);
	}

	// spec: LOUPE-003.2
	public function testStoresBothKeys(): void {
		$answer = $this->service()->save($this->user(), ['infoPanelOpen' => true, 'gestureGuideSeen' => true]);

		$this->assertSame(['infoPanelOpen' => true, 'gestureGuideSeen' => true], $answer);
	}

	/** @return array<string, array{mixed}> */
	public static function invalidViewStates(): array {
		return [
			'null' => [null],
			'a string' => ['infoPanelOpen'],
			'a list' => [[true]],
			'an empty object' => [[]],
			'an unknown key' => [['infoPanelOpen' => true, 'tileSize' => true]],
			'a string value' => [['infoPanelOpen' => 'true']],
			'a number value' => [['gestureGuideSeen' => 1]],
			'a null value' => [['gestureGuideSeen' => null]],
		];
	}

	// spec: LOUPE-003.3
	#[DataProvider('invalidViewStates')]
	public function testRefusesAnythingButAnObjectOfKnownBooleans(mixed $viewState): void {
		$service = $this->service();

		try {
			$service->save($this->user(), $viewState);
			$this->fail('expected InvalidViewStateException');
		} catch (InvalidViewStateException) {
			$this->assertSame([], $this->stored);
		}
	}
}
