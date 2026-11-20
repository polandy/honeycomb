<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\XmpCacheController;
use OCA\Honeycomb\Service\CacheClear;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpCacheService;
use OCA\Honeycomb\Tests\Service\FakeFileIdSearch;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCA\Honeycomb\Tests\Service\FakeQualityStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use OCA\Honeycomb\Tests\Service\XmpCacheRowTest;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\Response;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class XmpCacheControllerTest extends TestCase {
	use FakeFiles;
	use FakeFileIdSearch;

	private FakeXmpCacheStore $store;
	private FakeVisualHashStore $visualHashes;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeXmpCacheStore();
		$this->visualHashes = new FakeVisualHashStore();
	}

	private function controller(bool $loggedIn = true): XmpCacheController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $this->user() : null);
		$userFolder = $this->folder('');
		$find = fn (int $id): ?Node => $id === 9 ? $this->file(9, '/P/A.XMP', 'application/octet-stream') : null;
		$userFolder->method('search')->willReturnCallback(self::fileIdSearch($find));
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$service = new XmpCacheService($this->store, new FakeTagStore(), new UserPhotos(new UserFolderResolver($root)));
		return new XmpCacheController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service, new CacheClear($this->store, $this->visualHashes, new FakeQualityStore()));
	}

	// spec: XMP-006.1
	public function testAnswersTheStoredRows(): void {
		$this->store->rows['alice'][9] = XmpCacheRow::fromRequest(XmpCacheRowTest::item());

		$response = $this->controller()->lookup([9, 10]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['entries' => [XmpCacheRowTest::item(['tags' => ['Holiday', 'People/Anna']])]], json_decode($response->render(), true));
	}

	// spec: XMP-006.3
	public function testAnswersTheSavedFileIds(): void {
		$response = $this->controller()->save([XmpCacheRowTest::item(), XmpCacheRowTest::item(['fileId' => 10])]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['saved' => [9]], json_decode($response->render(), true));
	}

	// spec: XMP-006.4
	public function testAnswersBadRequestForAMalformedRow(): void {
		$response = $this->controller()->save([XmpCacheRowTest::item(['state' => 'stale'])]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], $this->store->rows);
	}

	// spec: XMP-006.4
	public function testAnswersBadRequestForAMalformedLookup(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->lookup(['9'])->getStatus());
	}

	// spec: XMP-006.5
	public function testClearsTheUsersCacheKeepsTheHashesAndAnswersNoContent(): void {
		$this->store->rows['alice'][9] = XmpCacheRow::fromRequest(XmpCacheRowTest::item());
		$this->visualHashes->rows[7] = new VisualHash(7, 'etag-7', '00ff00ff00ff00ff');

		$response = $this->controller()->clear();

		$this->assertSame(Http::STATUS_NO_CONTENT, $response->getStatus());
		$this->assertSame([], $this->store->rows);
		$this->assertSame([7], array_keys($this->visualHashes->rows));
	}

	/** @return array<string, array{\Closure(XmpCacheController): \OCP\AppFramework\Http\Response}> */
	public static function routes(): array {
		return [
			'lookup' => [static fn (XmpCacheController $c) => $c->lookup([9])],
			'save' => [static fn (XmpCacheController $c) => $c->save([])],
			'clear' => [static fn (XmpCacheController $c) => $c->clear()],
		];
	}

	// spec: XMP-006.4
	/** @param \Closure(XmpCacheController): Response $call */
	#[DataProvider('routes')]
	public function testAnswersUnauthorizedWithoutAUser(\Closure $call): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $call($this->controller(false))->getStatus());
	}

	/** @return array<string, array{string, string, string, bool}> */
	public static function attributes(): array {
		return [
			'lookup' => ['lookup', 'POST', '/api/v1/xmp-cache/lookup', false],
			'save' => ['save', 'PUT', '/api/v1/xmp-cache', true],
			'clear' => ['clear', 'DELETE', '/api/v1/xmp-cache', true],
		];
	}

	// spec: XMP-006.4
	#[DataProvider('attributes')]
	public function testRoutesForUsersWithCsrfCheck(string $method, string $verb, string $url, bool $rateLimited): void {
		$reflection = new ReflectionMethod(XmpCacheController::class, $method);
		$route = $reflection->getAttributes(FrontpageRoute::class)[0]->getArguments();

		$this->assertSame(['verb' => $verb, 'url' => $url], $route);
		$this->assertCount(1, $reflection->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $reflection->getAttributes(NoCSRFRequired::class));
		$this->assertCount($rateLimited ? 1 : 0, $reflection->getAttributes(UserRateLimit::class));
	}
}
