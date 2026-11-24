<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
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
		return new ViewStateController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), new ViewStateService($config));
	}

	// spec: LOUPE-003.1
	public function testAnswersNullForKeysNeverStored(): void {
		$response = $this->controller()->index();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('{"viewState":{"info_panel_open":null,"gesture_guide_seen":null,"series_hint_seen":null,"reject_hint_seen":null,"year_review_hint_closed":null,"immich_filters":null}}', $response->render());
	}

	// spec: LOUPE-003.1, LOUPE-003.2
	public function testAnswersTheFullViewStateAfterAPartialWriteAndReadsItBack(): void {
		$controller = $this->controller();

		$saved = $controller->save(['gesture_guide_seen' => true]);
		$read = $controller->index();

		$expected = '{"viewState":{"info_panel_open":null,"gesture_guide_seen":true,"series_hint_seen":null,"reject_hint_seen":null,"year_review_hint_closed":null,"immich_filters":null}}';
		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame($expected, $saved->render());
		$this->assertSame($expected, $read->render());
	}

	/** @return array<string, array{mixed, string}> */
	public static function malformed(): array {
		return [
			'no body' => [null, 'not-an-object'],
			'a string' => ['gesture_guide_seen', 'not-an-object'],
			'an empty object' => [[], 'not-an-object'],
			'an unknown key' => [['tileSize' => true], 'bad-value'],
			'a non-boolean' => [['info_panel_open' => 'yes'], 'bad-value'],
		];
	}

	// spec: LOUPE-003.3
	#[DataProvider('malformed')]
	public function testAMalformedViewStateIsABadRequest(mixed $viewState, string $reason): void {
		$response = $this->controller()->save($viewState);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame(['error' => 'request', 'reason' => $reason], json_decode($response->render(), true));
		$this->assertSame([], $this->stored);
	}

	// spec: LOUPE-003.4
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->index()->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save(['info_panel_open' => true])->getStatus());
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
