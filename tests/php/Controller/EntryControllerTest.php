<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\EntryController;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Listing\EntryFactory;
use OCA\Honeycomb\Service\Listing\ListingService;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Files\IRootFolder;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class EntryControllerTest extends TestCase {
	use FakeFiles;
	use FolderSourceFixture;

	/** @param array<string, mixed> $params */
	private function controller(IRootFolder $root, ?IUser $user, array $params = []): EntryController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$listing = new ListingService(new UserFolderResolver($root), new EntryFactory($this->createStub(IFilesMetadataManager::class), new FakeVisualHashStore(), new FakeFlagStore(), new FakeQualityStore()));
		$request = $this->createStub(IRequest::class);
		$request->method('getParam')->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $params[$key] ?? $default);
		return new EntryController(Application::APP_ID, $request, new ApiResponse($session), $this->folderSource(listing: $listing));
	}

	// spec: LISTING-001.1
	public function testReturnsTheListingAsJson(): void {
		$photos = $this->treeOf([$this->file(1, '/Photos/2024/IMG_0001.JPG')]);

		$response = $this->controller($this->rootWith(['/Photos' => $photos]), $this->user())->index('Photos', true);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		/** @var array{entries: list<array{path: string}>, truncated: bool} $json */
		$json = json_decode($response->render(), true, flags: JSON_THROW_ON_ERROR);
		$this->assertSame(['/Photos/2024/IMG_0001.JPG'], array_column($json['entries'], 'path'));
		$this->assertFalse($json['truncated']);
	}

	// spec: LISTING-001.16
	public function testLeavesOutTheExcludedFolders(): void {
		$photos = $this->treeOf([$this->file(1, '/Photos/2024/IMG_0001.JPG'), $this->file(2, '/Photos/2025/IMG_0002.JPG')]);

		$response = $this->controller($this->rootWith(['/Photos' => $photos]), $this->user(), ['excluded' => ['/Photos/2024']])->index('Photos', true);

		/** @var array{entries: list<array{path: string}>} $json */
		$json = json_decode($response->render(), true, flags: JSON_THROW_ON_ERROR);
		$this->assertSame(['/Photos/2025/IMG_0002.JPG'], array_column($json['entries'], 'path'));
	}

	/** @return array<string, array{mixed}> */
	public static function malformedExclusions(): array {
		return [
			'a string' => ['/Photos/2024'],
			'a number' => [[7]],
			'a map' => [['a' => '/Photos/2024']],
			'a parent step' => [['/Photos/../Other']],
			'too many' => [array_fill(0, 1_001, '/Photos/2024')],
		];
	}

	// spec: LISTING-001.16
	#[DataProvider('malformedExclusions')]
	public function testMalformedExclusionsAreABadRequest(mixed $excluded): void {
		$photos = $this->treeOf([$this->file(1, '/Photos/2024/IMG_0001.JPG')]);

		$response = $this->controller($this->rootWith(['/Photos' => $photos]), $this->user(), ['excluded' => $excluded])->index('Photos', true);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
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
