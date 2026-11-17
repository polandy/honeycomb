<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\SeriesController;
use OCA\Honeycomb\Service\SeriesService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeSeriesStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class SeriesControllerTest extends TestCase {
	use FakeFiles;

	private FakeSeriesStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeSeriesStore();
	}

	private function controller(bool $loggedIn = true): SeriesController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $this->user() : null);
		$userFolder = $this->folder('');
		$userFolder->method('getFirstNodeById')->willReturnCallback(fn (int $id) => $this->file($id, "/P/IMG_$id.JPG"));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$service = new SeriesService($this->store, new UserPhotos(new UserFolderResolver($root)));
		return new SeriesController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service);
	}

	// spec: SERIES-005.20, SERIES-005.21
	public function testAnswersTheWrittenSeriesOnTheNextLookup(): void {
		$controller = $this->controller();
		$save = $controller->save([['id' => null, 'status' => 'done', 'fileIds' => [7, 8]]], [9], []);
		$this->assertSame(Http::STATUS_OK, $save->getStatus());
		$this->assertSame(['ids' => [1], 'saved' => [7, 8, 9]], json_decode($save->render(), true));
		$lookup = $controller->lookup([7, 9]);
		$this->assertSame(Http::STATUS_OK, $lookup->getStatus());
		$this->assertSame(
			['series' => [['id' => 1, 'status' => 'done', 'fileIds' => [7], 'elsewhere' => true]], 'keptOut' => [9]],
			json_decode($lookup->render(), true),
		);
	}

	// spec: SERIES-005.20
	public function testAMalformedLookupIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->lookup(['7'])->getStatus());
	}

	// spec: SERIES-005.23
	public function testAMalformedSaveIsABadRequestAndWritesNothing(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->save([['id' => null, 'status' => 'open', 'fileIds' => [7]]], [7], [])->getStatus());
		$this->assertSame(0, $this->store->writeCalls);
	}

	// spec: SERIES-005.23
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->lookup([7])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save([], [7], [])->getStatus());
		$this->assertSame(0, $this->store->writeCalls);
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return [
			'lookup' => ['lookup', 'POST', '/api/v1/series/lookup'],
			'save' => ['save', 'PUT', '/api/v1/series'],
		];
	}

	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb, string $url): void {
		$method = new ReflectionMethod(SeriesController::class, $action);
		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
