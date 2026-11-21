<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\TrashController;
use OCA\Honeycomb\Service\TrashBinGuard;
use OCA\Honeycomb\Service\TrashNameSpacing;
use OCA\Honeycomb\Service\TrashService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Tests\Service\FakeClock;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\App\IAppManager;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\Files\File;
use OCP\Files\FileInfo;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\Storage\IStorage;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

final class TrashControllerTest extends TestCase {
	use StatsFixture;

	private function controller(bool $loggedIn = true, bool $trashBin = true): TrashController {
		$storage = $this->createStub(IStorage::class);
		$storage->method('instanceOfStorage')->willReturnCallback(static fn (string $class): bool => $class === 'OCA\Files_Trashbin\Storage');
		$parent = $this->createStub(Folder::class);
		$parent->method('getFreeSpace')->willReturn(FileInfo::SPACE_UNLIMITED);
		$file = $this->createStub(File::class);
		$file->method('getParent')->willReturn($parent);
		$file->method('getStorage')->willReturn($storage);
		$file->method('getName')->willReturn('IMG_0001.JPG');
		$file->method('getMimetype')->willReturn('image/jpeg');
		$file->method('getEtag')->willReturn('etag-7');
		$file->method('isDeletable')->willReturn(true);
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $id === 7 ? $file : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn($trashBin);
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$userConfig = $this->createStub(IUserConfig::class);
		$userConfig->method('getValueString')->willReturnArgument(3);
		$appConfig = $this->createStub(IAppConfig::class);
		$appConfig->method('getValueString')->willReturnArgument(2);
		$guard = new TrashBinGuard($userConfig, $appConfig);
		$spacing = new TrashNameSpacing($this->createStub(ITimeFactory::class), new FakeClock());
		$trash = new TrashService(new UserPhotos(new UserFolderResolver($root)), $apps, $guard, $spacing, new FakeFlagStore(), $this->createStub(LoggerInterface::class), $this->stats());
		return new TrashController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $trash);
	}

	// spec: DELETE-001.1
	public function testAnswersTheResultOfEachFile(): void {
		$response = $this->controller()->trash([[['fileId' => 7, 'etag' => 'etag-7']], [['fileId' => 8, 'etag' => 'etag-8']]]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(
			['pictures' => [[['fileId' => 7, 'result' => 'trashed']], [['fileId' => 8, 'result' => 'notFound']]]],
			json_decode($response->render(), true),
		);
	}

	// spec: DELETE-001.6
	public function testAMalformedRequestIsABadRequest(): void {
		$response = $this->controller()->trash([[['fileId' => 7]]]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], json_decode($response->render(), true));
	}

	// spec: DELETE-001.16
	public function testPassesTheExpectationToTheCheck(): void {
		$response = $this->controller()->trash([[['fileId' => 7, 'etag' => 'etag-7']]], 'rejected');

		$this->assertSame(['pictures' => [[['fileId' => 7, 'result' => 'decisionChanged']]]], json_decode($response->render(), true));
	}

	// spec: DELETE-001.18
	public function testAMalformedExpectationIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->trash([[['fileId' => 7, 'etag' => 'etag-7']]], ['rejected'])->getStatus());
	}

	// spec: DELETE-001.5
	public function testWithoutTheTrashBinItIsAConflict(): void {
		$this->assertSame(Http::STATUS_CONFLICT, $this->controller(trashBin: false)->trash([[['fileId' => 7, 'etag' => 'etag-7']]])->getStatus());
	}

	// spec: DELETE-001.7
	public function testWithoutAUserNothingIsTrashed(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->trash([[['fileId' => 7, 'etag' => 'etag-7']]])->getStatus());
	}

	// spec: DELETE-001.7
	public function testIsARouteForEveryUserWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(TrashController::class, 'trash');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/trash'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
