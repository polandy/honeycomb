<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\DecisionController;
use OCA\Honeycomb\Service\DecisionService;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class DecisionControllerTest extends TestCase {
	private const array REJECTED = ['fileId' => 7, 'rating' => 0, 'colourLabel' => null, 'flag' => 'rejected', 'keepRaw' => false];

	private function controller(bool $loggedIn = true): DecisionController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		return new DecisionController(Application::APP_ID, $this->createStub(IRequest::class), $session, new DecisionService(new FakeDecisionStore()));
	}

	public function testAnswersTheStoredDecisionsOfTheFileIds(): void {
		$controller = $this->controller();

		$this->assertSame(Http::STATUS_NO_CONTENT, $controller->save([self::REJECTED])->getStatus());
		$response = $controller->lookup([7, 8]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['decisions' => [self::REJECTED]], json_decode($response->render(), true));
	}

	public function testAMalformedLookupIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->lookup(['7'])->getStatus());
	}

	public function testAMalformedSaveIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->save([['fileId' => 7]])->getStatus());
	}

	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->lookup([7])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save([self::REJECTED])->getStatus());
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return [
			'lookup' => ['lookup', 'POST', '/api/v1/decisions/lookup'],
			'save' => ['save', 'PUT', '/api/v1/decisions'],
		];
	}

	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb, string $url): void {
		$method = new ReflectionMethod(DecisionController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
