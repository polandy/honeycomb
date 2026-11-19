<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\FlagController;
use OCA\Honeycomb\Controller\WriteRateLimit;
use OCA\Honeycomb\Service\FlagService;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeUserPhotos;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class FlagControllerTest extends TestCase {
	use FakeUserPhotos;

	private const array PICKED = ['fileId' => 7, 'flag' => 'picked', 'keepRaw' => false];

	private FakeFlagStore $store;

	private function controller(bool $loggedIn = true): FlagController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$this->store = new FakeFlagStore();
		$service = new FlagService($this->store, $this->userPhotos(7), $this->createStub(ITimeFactory::class));
		return new FlagController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service);
	}

	// spec: DECISIONS-001.23
	public function testASaveAnswersWhatItSavedAndSkipped(): void {
		$response = $this->controller()->save([self::PICKED, ['fileId' => 8, 'flag' => 'rejected', 'keepRaw' => true]]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['saved' => [7], 'skipped' => [['fileId' => 8, 'reason' => 'notFound']]], json_decode($response->render(), true));
	}

	// spec: DECISIONS-001.27
	public function testATakeOverAnswersWhatItInserted(): void {
		$response = $this->controller()->takeOver([self::PICKED]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['saved' => [7], 'skipped' => []], json_decode($response->render(), true));
	}

	// spec: DECISIONS-001.25
	public function testAMalformedBodyIsABadRequest(): void {
		$controller = $this->controller();

		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->save([['fileId' => 7]])->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->takeOver([['fileId' => 7, 'flag' => 'maybe', 'keepRaw' => false]])->getStatus());
		$this->assertSame(0, $this->store->writeCalls);
	}

	// spec: DECISIONS-001.26
	public function testWithoutAUserNothingIsWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save([self::PICKED])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->takeOver([self::PICKED])->getStatus());
		$this->assertSame(0, $this->store->writeCalls);
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return [
			'save' => ['save', 'PUT', '/api/v1/flags'],
			'take over' => ['takeOver', 'POST', '/api/v1/flags/take-over'],
		];
	}

	// spec: DECISIONS-001.26
	#[DataProvider('routes')]
	public function testEachActionIsARateLimitedRouteForEveryUserWithTheCsrfCheck(string $action, string $verb, string $url): void {
		$method = new ReflectionMethod(FlagController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
		$limits = $method->getAttributes(UserRateLimit::class);
		$this->assertCount(1, $limits);
		$this->assertSame(['limit' => WriteRateLimit::LIMIT, 'period' => WriteRateLimit::PERIOD_SECONDS], $limits[0]->getArguments());
	}
}
