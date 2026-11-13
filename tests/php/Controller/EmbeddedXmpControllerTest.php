<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\EmbeddedXmpController;
use OCA\Honeycomb\Service\EmbeddedXmpReader;
use OCA\Honeycomb\Service\JpegXmp;
use OCA\Honeycomb\Tests\Service\MemoryStream;
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
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

final class EmbeddedXmpControllerTest extends TestCase {
	private function controller(bool $loggedIn = true): EmbeddedXmpController {
		$jpeg = $this->createStub(File::class);
		$jpeg->method('getMimetype')->willReturn('image/jpeg');
		$jpeg->method('isReadable')->willReturn(true);
		$jpeg->method('fopen')->willReturnCallback(static fn () => MemoryStream::of("\xFF\xD8\xFF\xE1\x00\x22http://ns.adobe.com/xap/1.0/\x00old\xFF\xD9"));
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $id === 7 ? $jpeg : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$reader = new EmbeddedXmpReader($root, new JpegXmp(), $this->createStub(LoggerInterface::class));
		return new EmbeddedXmpController(Application::APP_ID, $this->createStub(IRequest::class), $session, $reader);
	}

	// spec: XMP-005.1
	public function testLookupAnswersEachJpeg(): void {
		$response = $this->controller()->lookup([7, 8]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['packets' => [
			['fileId' => 7, 'result' => 'read', 'content' => 'b2xk'],
			['fileId' => 8, 'result' => 'notFound'],
		]], json_decode($response->render(), true));
	}

	// spec: XMP-005.4
	public function testAMalformedRequestIsABadRequest(): void {
		$response = $this->controller()->lookup([7, 7]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], json_decode($response->render(), true));
	}

	// spec: XMP-005.5
	public function testWithoutAUserNothingIsRead(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->lookup([7])->getStatus());
	}

	// spec: XMP-005.5
	public function testIsARouteForEveryUserWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(EmbeddedXmpController::class, 'lookup');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/embedded-xmp/lookup'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
