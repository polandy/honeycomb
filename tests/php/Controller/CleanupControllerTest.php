<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\CleanupController;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\OrphanedFlags;
use OCA\Honeycomb\Tests\Service\FakeExistingFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class CleanupControllerTest extends TestCase {
	private FakeFlagStore $store;

	private function controller(bool $loggedIn = true): CleanupController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('admin');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$this->store = new FakeFlagStore();
		$this->store->rows = [7 => new FileFlag(7, Flag::Picked, false, 100), 8 => new FileFlag(8, Flag::Picked, false, 100)];
		$files = new FakeExistingFiles();
		$files->trashed = [7];
		return new CleanupController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), new OrphanedFlags($this->store, $files));
	}

	// spec: SETTINGS-001.27
	public function testAnswersHowManyRowsItRemoved(): void {
		$response = $this->controller()->cleanup();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['removed' => 1], json_decode($response->render(), true));
		$this->assertSame([8], array_keys($this->store->rows));
	}

	public function testWithoutAUserNothingIsRemoved(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->cleanup()->getStatus());
		$this->assertCount(2, $this->store->rows);
	}

	// spec: SETTINGS-001.27
	public function testIsARouteForAdminsOnlyWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(CleanupController::class, 'cleanup');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/cleanup'], $routes[0]->getArguments());
		$this->assertCount(0, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
