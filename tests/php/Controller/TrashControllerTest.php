<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\TrashController;
use OCA\Honeycomb\Service\TrashService;
use OCP\App\IAppManager;
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

final class TrashControllerTest extends TestCase {
	private function controller(bool $loggedIn = true, bool $trashBin = true): TrashController {
		$file = $this->createStub(File::class);
		$file->method('getName')->willReturn('IMG_0001.JPG');
		$file->method('getMimetype')->willReturn('image/jpeg');
		$file->method('getEtag')->willReturn('etag-7');
		$file->method('isDeletable')->willReturn(true);
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $id === 7 ? $file : null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn($trashBin);
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$trash = new TrashService($root, $apps, $this->createStub(LoggerInterface::class));
		return new TrashController(Application::APP_ID, $this->createStub(IRequest::class), $session, $trash);
	}

	public function testAnswersTheResultOfEachFile(): void {
		$response = $this->controller()->trash([[['fileId' => 7, 'etag' => 'etag-7']], [['fileId' => 8, 'etag' => 'etag-8']]]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(
			['pictures' => [[['fileId' => 7, 'result' => 'trashed']], [['fileId' => 8, 'result' => 'notFound']]]],
			json_decode($response->render(), true),
		);
	}

	public function testAMalformedRequestIsABadRequest(): void {
		$response = $this->controller()->trash([[['fileId' => 7]]]);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([], json_decode($response->render(), true));
	}

	public function testWithoutTheTrashBinItIsAConflict(): void {
		$this->assertSame(Http::STATUS_CONFLICT, $this->controller(trashBin: false)->trash([[['fileId' => 7, 'etag' => 'etag-7']]])->getStatus());
	}

	public function testWithoutAUserNothingIsTrashed(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->trash([[['fileId' => 7, 'etag' => 'etag-7']]])->getStatus());
	}

	public function testIsARouteForEveryUserWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(TrashController::class, 'trash');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/trash'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
