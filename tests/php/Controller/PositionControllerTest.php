<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\PositionController;
use OCA\Honeycomb\Service\PositionService;
use OCA\Honeycomb\Tests\Service\FakePositionStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class PositionControllerTest extends TestCase {
	private const int NOW = 1_700_000_000;
	private const array FOLDER_SET = ['paths' => ['/Photos'], 'subfolders' => false];

	private function controller(bool $loggedIn = true): PositionController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		return new PositionController(Application::APP_ID, $this->createStub(IRequest::class), $session, new PositionService(new FakePositionStore(), $time));
	}

	// spec: DECISIONS-002.1
	public function testAnswersTheSavedPositionAndListsIt(): void {
		$controller = $this->controller();
		$position = ['folderSet' => self::FOLDER_SET, 'fileId' => 12, 'decided' => 3, 'total' => 10, 'updatedAt' => self::NOW];

		$saved = $controller->save(self::FOLDER_SET, 12, 3, 10);
		$recent = $controller->index();

		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame($position, json_decode($saved->render(), true));
		$this->assertSame(['positions' => [$position]], json_decode($recent->render(), true));
	}

	// spec: DECISIONS-002.5
	public function testAMalformedPositionIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->save(['paths' => ['/../etc'], 'subfolders' => false], 12, 3, 10)->getStatus());
	}

	// spec: DECISIONS-002.6
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->index()->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save(self::FOLDER_SET, 12, 3, 10)->getStatus());
	}

	/** @return array<string, array{string, string}> */
	public static function routes(): array {
		return ['index' => ['index', 'GET'], 'save' => ['save', 'PUT']];
	}

	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb): void {
		$method = new ReflectionMethod(PositionController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => '/api/v1/positions'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
