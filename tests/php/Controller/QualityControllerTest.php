<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\QualityController;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Quality\QualityService;
use OCA\Honeycomb\Tests\Service\FakeFileIdSearch;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class QualityControllerTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	private FakeQualityStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeQualityStore();
	}

	private function controller(bool $loggedIn = true): QualityController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $this->user() : null);
		$userFolder = $this->folder('');
		$find = fn (int $id): ?Node => $id === 7 ? $this->file(7, '/P/A.JPG') : null;
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($find));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$service = new QualityService($this->store, new UserPhotos(new UserFolderResolver($root)));
		return new QualityController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service);
	}

	/** @return array<string, mixed> */
	private static function item(int $fileId, mixed $focusTile = 27): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'method' => 1, 'sharpness' => 812.4, 'focusTile' => $focusTile];
	}

	// spec: SERIES-006.7, SERIES-006.8
	public function testAnswersTheSavedFileIds(): void {
		$response = $this->controller()->save([self::item(7), self::item(8)]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['saved' => [7]], json_decode($response->render(), true));
	}

	// spec: SERIES-006.9
	public function testAMalformedSaveIsABadRequest(): void {
		$response = $this->controller()->save([self::item(7, 64)]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], $this->store->rows);
	}

	// spec: SERIES-006.10
	public function testWithoutAUserNothingIsWritten(): void {
		$response = $this->controller(false)->save([self::item(7)]);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
		$this->assertSame([], $this->store->rows);
	}

	public function testTheSaveIsRoutedForUsersWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(QualityController::class, 'save');
		$route = $method->getAttributes(FrontpageRoute::class)[0]->getArguments();

		$this->assertSame(['verb' => 'PUT', 'url' => '/api/v1/quality-values'], $route);
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}

	// spec: SERIES-006.11
	public function testTheSaveIsLimitedToThreeHundredRequestsAMinutePerUser(): void {
		$limit = (new ReflectionMethod(QualityController::class, 'save'))->getAttributes(UserRateLimit::class)[0]->getArguments();

		$this->assertSame(['limit' => 300, 'period' => 60], $limit);
	}
}
