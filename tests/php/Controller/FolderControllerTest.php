<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\FolderController;
use OCA\Honeycomb\Service\FolderService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class FolderControllerTest extends TestCase {
	use FakeFiles;

	private function controller(IRootFolder $root, ?IUser $user): FolderController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$folders = new FolderService(new UserFolderResolver($root));
		return new FolderController(Application::APP_ID, $this->createStub(IRequest::class), $session, $folders);
	}

	public function testReturnsTheChildFoldersAsJson(): void {
		$photos = $this->folder('/Photos');
		$year = $this->folder('/Photos/2024');
		$year->method('getDirectoryListing')->willReturn([]);
		$photos->method('getDirectoryListing')->willReturn([$year]);

		$response = $this->controller($this->rootWith(['/Photos' => $photos]), $this->user())->index('Photos');

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(
			['folders' => [['name' => '2024', 'path' => '/Photos/2024', 'hasSubfolders' => false]]],
			json_decode($response->render(), true, flags: JSON_THROW_ON_ERROR),
		);
	}

	public function testAMissingFolderIsNotFound(): void {
		$response = $this->controller($this->rootWith([]), $this->user())->index('Gone');

		$this->assertSame(Http::STATUS_NOT_FOUND, $response->getStatus());
	}

	public function testAnUnreadableFolderIsForbidden(): void {
		$response = $this->controller($this->rootWith(['/Photos' => $this->folder('/Photos', false)]), $this->user())->index('Photos');

		$this->assertSame(Http::STATUS_FORBIDDEN, $response->getStatus());
	}

	public function testWithoutAUserNothingIsListed(): void {
		$root = $this->createMock(IRootFolder::class);
		$root->expects($this->never())->method('getUserFolder');

		$response = $this->controller($root, null)->index('Photos');

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
	}

	public function testIndexIsAGetRouteForEveryUserWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(FolderController::class, 'index');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/folders'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
