<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\SettingsController;
use OCA\Honeycomb\Service\SettingsService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Config\IUserConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class SettingsControllerTest extends TestCase {
	/** @var array<string, string> */
	private array $stored = [];

	private function controller(bool $loggedIn = true): SettingsController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(
			fn (string $userId, string $app, string $key, string $default = ''): string => $this->stored["$userId/$app/$key"] ?? $default,
		);
		$config->method('setValueString')->willReturnCallback(function (string $userId, string $app, string $key, string $value): bool {
			$this->stored["$userId/$app/$key"] = $value;
			return true;
		});
		return new SettingsController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), new SettingsService($config));
	}

	/** @return array<string, string> a method so psalm does not narrow the property */
	private function storedNow(): array {
		return $this->stored;
	}

	// spec: SETTINGS-001.1
	public function testAnswersAnEmptyObjectWhenNothingIsStored(): void {
		$response = $this->controller()->index();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('{"settings":{}}', $response->render());
	}

	// spec: SETTINGS-001.1, SETTINGS-001.2
	public function testAnswersTheSavedSettingsAndReadsThemBack(): void {
		$controller = $this->controller();

		$saved = $controller->save(['showSingles' => false, 'swipes' => ['up' => 'picked', 'down' => null]]);
		$read = $controller->index();

		$expected = '{"settings":{"showSingles":false,"swipes":{"up":"picked","down":null}}}';
		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame($expected, $saved->render());
		$this->assertSame($expected, $read->render());
	}

	// spec: SETTINGS-001.4
	public function testSettingsThatAreNotAnObjectAreABadRequest(): void {
		$controller = $this->controller();

		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save(['nef', 'cr3'])->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save('viKeys')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save(null)->getStatus());
		$this->assertSame([], $this->stored);
	}

	// spec: SETTINGS-001.4
	public function testSettingsOverTheSizeLimitAreABadRequest(): void {
		$response = $this->controller()->save(['note' => str_repeat('x', SettingsService::MAX_BYTES)]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], $this->stored);
	}

	// spec: SETTINGS-001.5
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->index()->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save(['viKeys' => true])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->saveList('moveRecent', ['/A'])->getStatus());
		$this->assertSame([], $this->stored);
	}

	// spec: IMMICH-001.22
	public function testImmichOnlyIsStoredForTheUserAndNotWithoutOne(): void {
		$refused = $this->controller(loggedIn: false)->save(['immichOnly' => true]);
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $refused->getStatus());
		$this->assertSame([], $this->stored);

		$saved = $this->controller()->save(['immichOnly' => true]);

		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame(['alice/honeycomb/settings' => '{"immichOnly":true}'], $this->storedNow());
	}

	// spec: SETTINGS-001.31
	public function testAnswersASavedListAndReadsItBackInTheSettings(): void {
		$controller = $this->controller();

		$saved = $controller->saveList('libraryRoots', ['/Photos']);

		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame(['items' => ['/Photos']], json_decode($saved->render(), true));
		$this->assertSame(['settings' => ['libraryRoots' => ['/Photos']]], json_decode($controller->index()->render(), true));
	}

	// spec: SETTINGS-001.31
	public function testAnUnknownListOrOneThatIsNotAListIsABadRequest(): void {
		$controller = $this->controller();

		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->saveList('viKeys', ['/A'])->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->saveList('moveRecent', null)->getStatus());
		$this->assertSame([], $this->stored);
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return ['index' => ['index', 'GET', '/api/v1/settings'], 'save' => ['save', 'PUT', '/api/v1/settings'], 'saveList' => ['saveList', 'PUT', '/api/v1/settings/lists/{name}']];
	}

	// spec: SETTINGS-001.5
	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb, string $url): void {
		$method = new ReflectionMethod(SettingsController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
