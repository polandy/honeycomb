<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ViewStateController;
use OCA\Honeycomb\Service\ViewStateService;
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

final class ViewStateControllerTest extends TestCase {
	/** @var array<string, bool> */
	private array $stored = [];

	private function controller(bool $loggedIn = true): ViewStateController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$config = $this->createStub(IUserConfig::class);
		$config->method('hasKey')->willReturnCallback(fn (string $userId, string $app, string $key): bool => isset($this->stored[$key]));
		$config->method('getValueBool')->willReturnCallback(fn (string $userId, string $app, string $key): bool => $this->stored[$key] ?? false);
		$config->method('setValueBool')->willReturnCallback(function (string $userId, string $app, string $key, bool $value): bool {
			$this->stored[$key] = $value;
			return true;
		});
		return new ViewStateController(Application::APP_ID, $this->createStub(IRequest::class), $session, new ViewStateService($config));
	}

	// spec: LOUPE-003.1
	public function testAnswersNullForKeysNeverStored(): void {
		$response = $this->controller()->index();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('{"viewState":{"infoPanelOpen":null,"gestureGuideSeen":null}}', $response->render());
	}

	// spec: LOUPE-003.1, LOUPE-003.2
	public function testAnswersTheFullViewStateAfterAPartialWriteAndReadsItBack(): void {
		$controller = $this->controller();

		$saved = $controller->save(['gestureGuideSeen' => true]);
		$read = $controller->index();

		$expected = '{"viewState":{"infoPanelOpen":null,"gestureGuideSeen":true}}';
		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame($expected, $saved->render());
		$this->assertSame($expected, $read->render());
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		return [
			'no body' => [null],
			'a string' => ['gestureGuideSeen'],
			'an empty object' => [[]],
			'an unknown key' => [['tileSize' => true]],
			'a non-boolean' => [['infoPanelOpen' => 'yes']],
		];
	}

	// spec: LOUPE-003.3
	#[DataProvider('malformed')]
	public function testAMalformedViewStateIsABadRequestWithAnEmptyBody(mixed $viewState): void {
		$response = $this->controller()->save($viewState);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame('[]', $response->render());
		$this->assertSame([], $this->stored);
	}

	// spec: LOUPE-003.4
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->index()->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save(['infoPanelOpen' => true])->getStatus());
		$this->assertSame([], $this->stored);
	}

	/** @return array<string, array{string, string}> */
	public static function routes(): array {
		return ['index' => ['index', 'GET'], 'save' => ['save', 'PUT']];
	}

	// spec: LOUPE-003.4
	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb): void {
		$method = new ReflectionMethod(ViewStateController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => '/api/v1/view-state'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
