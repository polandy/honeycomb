<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\SidecarController;
use OCA\Honeycomb\Service\SidecarReader;
use OCA\Honeycomb\Service\SidecarWriter;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

final class SidecarControllerTest extends TestCase {
	private function controller(bool $loggedIn = true): SidecarController {
		$sidecar = $this->createStub(File::class);
		$sidecar->method('getId')->willReturn(9);
		$sidecar->method('getName')->willReturn('IMG_0001.NEF.xmp');
		$sidecar->method('getEtag')->willReturn('etag-9');
		$sidecar->method('getSize')->willReturn(3);
		$sidecar->method('getMTime')->willReturn(1_700_000_000);
		$sidecar->method('isReadable')->willReturn(true);
		$sidecar->method('getContent')->willReturn('old');
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $id === 9 ? $sidecar : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$logger = $this->createStub(LoggerInterface::class);
		return new SidecarController(Application::APP_ID, $this->createStub(IRequest::class), $session, new SidecarReader($root, $logger), new SidecarWriter($root, $logger));
	}

	// spec: XMP-002.1
	public function testLookupAnswersEachSidecar(): void {
		$response = $this->controller()->lookup([9, 8]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['sidecars' => [
			['fileId' => 9, 'result' => 'read', 'content' => 'b2xk', 'etag' => 'etag-9', 'size' => 3, 'mtime' => 1_700_000_000],
			['fileId' => 8, 'result' => 'notFound'],
		]], json_decode($response->render(), true));
	}

	// spec: XMP-002.6
	public function testSaveAnswersEachSidecar(): void {
		$response = $this->controller()->save([['fileId' => 8, 'etag' => 'etag-8', 'size' => 3, 'content' => 'bmV3'], ['fileId' => 9, 'etag' => 'etag-0', 'size' => 3, 'content' => 'bmV3']]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['sidecars' => [['result' => 'notFound'], ['result' => 'changed']]], json_decode($response->render(), true));
	}

	// spec: XMP-002.7
	public function testAMalformedRequestIsABadRequest(): void {
		foreach ([$this->controller()->lookup([9, 9]), $this->controller()->save([['fileId' => 9]])] as $response) {
			$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
			$this->assertSame([], json_decode($response->render(), true));
		}
	}

	// spec: XMP-002.8
	public function testWithoutAUserNothingIsReadOrWritten(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->lookup([9])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->save([])->getStatus());
	}

	/** @return array<string, array{string, string, string}> */
	public static function routes(): array {
		return [
			'lookup' => ['lookup', 'POST', '/api/v1/sidecars/lookup'],
			'save' => ['save', 'PUT', '/api/v1/sidecars'],
		];
	}

	// spec: XMP-002.8
	#[DataProvider('routes')]
	public function testIsARouteForEveryUserWithTheCsrfCheck(string $name, string $verb, string $url): void {
		$method = new ReflectionMethod(SidecarController::class, $name);

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => $verb, 'url' => $url], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
