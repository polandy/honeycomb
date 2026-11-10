<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\EntryController;
use OCA\Honeycomb\Service\EntryFactory;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Files\IRootFolder;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class EntryControllerTest extends TestCase {
	use FakeFiles;

	private function controller(IRootFolder $root, ?IUser $user): EntryController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$listing = new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class)));
		return new EntryController(Application::APP_ID, $this->createStub(IRequest::class), $session, $listing);
	}

	// spec: LISTING-001.1
	public function testReturnsTheListingAsJson(): void {
		$photos = $this->folder('/Photos');
		$photos->method('search')->willReturnCallback($this->searchOver([$this->file(1, '/Photos/2024/IMG_0001.JPG')]));

		$response = $this->controller($this->rootWith(['/Photos' => $photos]), $this->user())->index('Photos', true);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		/** @var array{entries: list<array{path: string}>, truncated: bool} $json */
		$json = json_decode($response->render(), true, flags: JSON_THROW_ON_ERROR);
		$this->assertSame(['/Photos/2024/IMG_0001.JPG'], array_column($json['entries'], 'path'));
		$this->assertFalse($json['truncated']);
	}

	// spec: LISTING-001.7
	public function testAMissingFolderIsNotFound(): void {
		$response = $this->controller($this->rootWith([]), $this->user())->index('Gone');

		$this->assertSame(Http::STATUS_NOT_FOUND, $response->getStatus());
	}

	// spec: LISTING-001.8
	public function testAnUnreadableFolderIsForbidden(): void {
		$response = $this->controller($this->rootWith(['/Photos' => $this->folder('/Photos', false)]), $this->user())->index('Photos');

		$this->assertSame(Http::STATUS_FORBIDDEN, $response->getStatus());
	}

	// spec: LISTING-001.9
	public function testWithoutAUserNothingIsListed(): void {
		$root = $this->createMock(IRootFolder::class);
		$root->expects($this->never())->method('getUserFolder');

		$response = $this->controller($root, null)->index('Photos');

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
	}

	// spec: LISTING-001.9
	public function testIndexIsAGetRouteForEveryUserWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(EntryController::class, 'index');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/entries'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
