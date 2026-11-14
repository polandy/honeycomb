<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\VisualHashController;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\VisualHashService;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class VisualHashControllerTest extends TestCase {
	use FakeFiles;

	private const string HASH = '00ff00ff00ff00ff';

	private FakeVisualHashStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeVisualHashStore();
	}

	private function controller(bool $loggedIn = true): VisualHashController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $this->user() : null);
		$userFolder = $this->folder('');
		$userFolder->method('getFirstNodeById')->willReturnCallback(fn (int $id): ?Node => $id === 7 ? $this->file(7, '/P/A.JPG') : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new VisualHashController(Application::APP_ID, $this->createStub(IRequest::class), $session, new VisualHashService($this->store, new UserFolderResolver($root)));
	}

	// spec: SERIES-003.3, SERIES-003.4
	public function testAnswersTheSavedFileIds(): void {
		$response = $this->controller()->save([
			['fileId' => 7, 'etag' => 'etag-7', 'hash' => self::HASH],
			['fileId' => 8, 'etag' => 'etag-8', 'hash' => self::HASH],
		]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['saved' => [7]], json_decode($response->render(), true));
	}

	// spec: SERIES-003.6
	public function testAMalformedSaveIsABadRequest(): void {
		$response = $this->controller()->save([['fileId' => 7, 'etag' => 'etag-7', 'hash' => 'not a hash']]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], $this->store->rows);
	}

	// spec: SERIES-003.7
	public function testWithoutAUserNothingIsWritten(): void {
		$response = $this->controller(false)->save([['fileId' => 7, 'etag' => 'etag-7', 'hash' => self::HASH]]);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
		$this->assertSame([], $this->store->rows);
	}

	public function testTheSaveIsRoutedForUsersWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(VisualHashController::class, 'save');
		$route = $method->getAttributes(FrontpageRoute::class)[0]->getArguments();

		$this->assertSame(['verb' => 'PUT', 'url' => '/api/v1/visual-hashes'], $route);
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
