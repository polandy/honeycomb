<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\OrphanedSidecarController;
use OCA\Honeycomb\Service\OrphanedSidecarScan;
use OCA\Honeycomb\Service\OrphanedSidecarTrash;
use OCA\Honeycomb\Service\TrashBinGuard;
use OCA\Honeycomb\Service\TrashNameSpacing;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Tests\Service\FakeClock;
use OCA\Honeycomb\Tests\Service\FakeTree;
use OCP\App\IAppManager;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

final class OrphanedSidecarControllerTest extends TestCase {
	use FakeTree;

	private function controller(bool $trashBin = true): OrphanedSidecarController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($this->treeUser());
		$folders = new UserFolderResolver($this->treeRoot());
		$apps = $this->createStub(IAppManager::class);
		$apps->method('isEnabledForUser')->willReturn($trashBin);
		$userConfig = $this->createStub(IUserConfig::class);
		$userConfig->method('getValueString')->willReturnArgument(3);
		$appConfig = $this->createStub(IAppConfig::class);
		$appConfig->method('getValueString')->willReturn('-1');
		$clock = new FakeClock();
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(static fn (): int => $clock->now);
		$trash = new OrphanedSidecarTrash(new UserPhotos($folders), $apps, new TrashBinGuard($userConfig, $appConfig), new TrashNameSpacing($time, $clock), $this->createStub(LoggerInterface::class));
		return new OrphanedSidecarController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), new OrphanedSidecarScan($folders), $trash);
	}

	// spec: XMP-009.3
	public function testAnswersAPageOfOrphanedSidecars(): void {
		$this->addFiles([1 => '/P/a.xmp', 2 => '/P/b.JPG', 3 => '/P/b.xmp']);

		$response = $this->controller()->orphaned('/P', '');

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['sidecars' => [['fileId' => 1, 'etag' => 'etag-1', 'path' => '/P/a.xmp', 'size' => 100]], 'nextCursor' => null], json_decode($response->render(), true));
	}

	// spec: XMP-009.5
	public function testAWrongPathOrCursorIsRefused(): void {
		$this->addFiles([1 => '/P/a.xmp']);

		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller()->orphaned('/Nope', '')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->orphaned('/P', '../x')->getStatus());
	}

	// spec: XMP-009.6
	public function testAnswersEachSidecarsResult(): void {
		$this->addFiles([1 => '/P/a.xmp', 2 => '/P/b.JPG', 3 => '/P/b.xmp']);

		$response = $this->controller()->trash([['fileId' => 1, 'etag' => 'etag-1'], ['fileId' => 3, 'etag' => 'etag-3']]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['sidecars' => [['fileId' => 1, 'result' => 'trashed'], ['fileId' => 3, 'result' => 'notOrphaned']]], json_decode($response->render(), true));
		$this->assertSame([1], $this->trashed);
	}

	// spec: XMP-009.9
	public function testAMalformedRequestOrADisabledTrashBinIsRefused(): void {
		$this->addFiles([1 => '/P/a.xmp']);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->trash([['fileId' => 1]])->getStatus());
		$this->assertSame(Http::STATUS_CONFLICT, $this->controller(trashBin: false)->trash([['fileId' => 1, 'etag' => 'etag-1']])->getStatus());
		$this->assertSame([], $this->trashed);
	}

	// spec: XMP-009.3, XMP-009.6
	public function testTheEndpointsAreRoutedForUsersAndTheTrashIsLimited(): void {
		$scan = new ReflectionMethod(OrphanedSidecarController::class, 'orphaned');
		$trash = new ReflectionMethod(OrphanedSidecarController::class, 'trash');

		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/sidecars/orphaned'], $scan->getAttributes(FrontpageRoute::class)[0]->getArguments());
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/sidecars/orphaned/trash'], $trash->getAttributes(FrontpageRoute::class)[0]->getArguments());
		$this->assertCount(1, $scan->getAttributes(NoAdminRequired::class));
		$this->assertCount(1, $trash->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $trash->getAttributes(NoCSRFRequired::class));
		$this->assertCount(1, $trash->getAttributes(UserRateLimit::class));
	}
}
