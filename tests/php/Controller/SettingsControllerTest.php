<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
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
	private string $stored = '';

	private function controller(bool $loggedIn = true): SettingsController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(fn (): string => $this->stored);
		$config->method('setValueString')->willReturnCallback(function (string $userId, string $app, string $key, string $value): bool {
			$this->stored = $value;
			return true;
		});
		return new SettingsController(Application::APP_ID, $this->createStub(IRequest::class), $session, new SettingsService($config));
	}

	public function testAnswersAnEmptyObjectWhenNothingIsStored(): void {
		$response = $this->controller()->index();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('{"settings":{}}', $response->render());
	}

	public function testAnswersTheSavedSettingsAndReadsThemBack(): void {
		$controller = $this->controller();

		$saved = $controller->save(['showSingles' => false, 'swipes' => ['up' => 'picked', 'down' => null]]);
		$read = $controller->index();

		$expected = '{"settings":{"showSingles":false,"swipes":{"up":"picked","down":null}}}';
		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame($expected, $saved->render());
		$this->assertSame($expected, $read->render());
	}

	public function testSettingsThatAreNotAnObjectAreABadRequest(): void {
		$controller = $this->controller();

		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save(['nef', 'cr3'])->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save('viKeys')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save(null)->getStatus());
		$this->assertSame('', $this->stored);
	}

	public function testSettingsOverTheSizeLimitAreABadRequest(): void {
		$response = $this->controller()->save(['note' => str_repeat('x', SettingsService::MAX_BYTES)]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame('', $this->stored);
	}

	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->index()->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save(['viKeys' => true])->getStatus());
		$this->assertSame('', $this->stored);
	}

	/** @return array<string, array{string, string}> */
	public static function routes(): array {
		return ['index' => ['index', 'GET'], 'save' => ['save', 'PUT']];
	}

	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb): void {
		$method = new ReflectionMethod(SettingsController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => '/api/v1/settings'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
