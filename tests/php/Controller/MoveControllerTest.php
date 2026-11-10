<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\MoveController;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\MoveTargetService;
use OCA\Honeycomb\Tests\Service\FakeTree;
use OCP\App\IAppManager;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

final class MoveControllerTest extends TestCase {
	use FakeTree;

	private function controller(bool $loggedIn = true, bool $trashBin = true): MoveController {
		$this->addFiles([7 => '/In/A.JPG', 9 => '/Out/A.JPG']);
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn($trashBin);
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $this->treeUser() : null);
		$move = new MoveService($this->treeRoot(), $apps, $this->createStub(LoggerInterface::class));
		return new MoveController(Application::APP_ID, $this->createStub(IRequest::class), $session, $move, new MoveTargetService($this->treeRoot()));
	}

	// spec: MOVE-002.1
	public function testTheProbeAnswersTheChildrenOfEachFolder(): void {
		$response = $this->controller()->targets(['/Out']);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['folders' => [['path' => '/Out', 'children' => [['name' => 'A.JPG', 'fileId' => 9, 'etag' => 'etag-9']]]]], json_decode($response->render(), true));
	}

	// spec: MOVE-002.2
	public function testTheMoveAnswersTheResultOfEachFile(): void {
		$response = $this->controller()->move([[['fileId' => 7, 'etag' => 'etag-7', 'path' => '/Out/B.JPG']], [['fileId' => 8, 'etag' => 'etag-8', 'path' => '/Out/C.JPG']]]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['pictures' => [
			[['fileId' => 7, 'result' => 'moved', 'replaced' => false, 'path' => '/Out/B.JPG', 'newFileId' => 7, 'etag' => 'etag-7']],
			[['fileId' => 8, 'result' => 'notFound', 'replaced' => false]],
		]], json_decode($response->render(), true));
	}

	// spec: MOVE-002.8
	public function testAMalformedRequestIsABadRequest(): void {
		foreach ([$this->controller()->move([[['fileId' => 7, 'etag' => 'etag-7', 'path' => 'Out']]]), $this->controller()->targets(['Out'])] as $response) {
			$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
			$this->assertSame([], json_decode($response->render(), true));
		}
	}

	// spec: MOVE-002.7
	public function testAReplaceWithoutTheTrashBinIsAConflict(): void {
		$replace = ['fileId' => 7, 'etag' => 'etag-7', 'path' => '/Out/A.JPG', 'replace' => ['fileId' => 9, 'etag' => 'etag-9']];

		$this->assertSame(Http::STATUS_CONFLICT, $this->controller(trashBin: false)->move([[$replace]])->getStatus());
	}

	// spec: MOVE-002.9
	public function testWithoutAUserNothingMoves(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->move([[['fileId' => 7, 'etag' => 'etag-7', 'path' => '/Out/B.JPG']]])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->targets(['/Out'])->getStatus());
		$this->assertSame('/In/A.JPG', $this->files[7]);
	}

	/** @return array<string, array{string, string}> */
	public static function routes(): array {
		return ['move' => ['move', '/api/v1/move'], 'probe' => ['targets', '/api/v1/move/targets']];
	}

	// spec: MOVE-002.9
	#[DataProvider('routes')]
	public function testIsARouteForEveryUserWithTheCsrfCheck(string $name, string $url): void {
		$method = new ReflectionMethod(MoveController::class, $name);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'POST', 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
