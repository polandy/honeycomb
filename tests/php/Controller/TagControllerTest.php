<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\TagController;
use OCA\Honeycomb\Service\Decision\TagService;
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
		return new TagController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), new TagService($this->store));
	}

	// spec: TAGS-001.5
	public function testAnswersTheTagList(): void {
		$this->store->addToTagList('alice', ['Places/Italy', 'People/Anna']);

		$response = $this->controller()->tagList();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['tagList' => ['People/Anna', 'Places/Italy']], json_decode($response->render(), true));
	}

	// spec: TAGS-001.16
	public function testNoFileTagRouteIsLeft(): void {
		$this->assertSame(['tagList'], array_values(array_filter(
			array_map(static fn (ReflectionMethod $method): string => $method->getName(), (new \ReflectionClass(TagController::class))->getMethods(ReflectionMethod::IS_PUBLIC)),
			static fn (string $name): bool => (new ReflectionMethod(TagController::class, $name))->getAttributes(FrontpageRoute::class) !== [],
		)));
	}

	public function testWithoutAUserTheTagListIsNotRead(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->tagList()->getStatus());
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return [
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
