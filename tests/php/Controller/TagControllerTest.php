<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\TagController;
use OCA\Honeycomb\Service\TagService;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class TagControllerTest extends TestCase {
	private const array TAGGED = ['fileId' => 7, 'tags' => ['People/Anna', 'Places/Italy']];

	private FakeTagStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeTagStore();
	}

	private function controller(bool $loggedIn = true): TagController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		return new TagController(Application::APP_ID, $this->createStub(IRequest::class), $session, new TagService($this->store));
	}

	// spec: TAGS-001.1, TAGS-001.5
	public function testAnswersTheStoredTagsAndTheTagList(): void {
		$controller = $this->controller();

		$this->assertSame(Http::STATUS_NO_CONTENT, $controller->save([self::TAGGED])->getStatus());
		$lookup = $controller->lookup([7, 8]);
		$tagList = $controller->tagList();

		$this->assertSame(Http::STATUS_OK, $lookup->getStatus());
		$this->assertSame(['tags' => [self::TAGGED]], json_decode($lookup->render(), true));
		$this->assertSame(Http::STATUS_OK, $tagList->getStatus());
		$this->assertSame(['tagList' => ['People/Anna', 'Places/Italy']], json_decode($tagList->render(), true));
	}

	// spec: TAGS-001.7
	public function testAMalformedLookupIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->lookup(['7'])->getStatus());
	}

	// spec: TAGS-001.6
	public function testAMalformedSaveIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->save([['fileId' => 7, 'tags' => ['A|B']]])->getStatus());
	}

	// spec: TAGS-001.8
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->lookup([7])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->save([self::TAGGED])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->tagList()->getStatus());
		$this->assertSame([], $this->store->rows);
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return [
			'lookup' => ['lookup', 'POST', '/api/v1/tags/lookup'],
			'save' => ['save', 'PUT', '/api/v1/tags'],
			'tag list' => ['tagList', 'GET', '/api/v1/tags/list'],
		];
	}

	#[DataProvider('routes')]
	public function testEachActionIsARouteForEveryUserWithTheCsrfCheck(string $action, string $verb, string $url): void {
		$method = new ReflectionMethod(TagController::class, $action);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
