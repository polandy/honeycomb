<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\LibraryController;
use OCA\Honeycomb\Service\CaptureTimes;
use OCA\Honeycomb\Service\FolderSummary;
use OCA\Honeycomb\Service\LibraryFolder;
use OCA\Honeycomb\Service\LibraryFolderService;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFolderDoneStore;
use OCA\Honeycomb\Tests\Service\FakeFolderSummaryStore;
use OCA\Honeycomb\Tests\Service\FakeLibraryFiles;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class LibraryControllerTest extends TestCase {
	use FakeFiles;

	private FakeFolderSummaryStore $summaries;

	#[\Override]
	protected function setUp(): void {
		$this->summaries = new FakeFolderSummaryStore();
	}

	private function controller(?IUser $user = null, bool $loggedIn = true): LibraryController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? ($user ?? $this->user()) : null);
		$files = new FakeLibraryFiles();
		$files->folders = [new LibraryFolder(10, '', 'e-10', Constants::PERMISSION_ALL)];
		$root = $this->rootWith(['/Photos' => $this->folder('/Photos', fileId: 10), '/Shared' => $this->folder('/Shared', mountType: 'shared')]);
		$service = new LibraryFolderService(new UserFolderResolver($root), $files, $this->summaries, new FakeFolderDoneStore(), new CaptureTimes($this->createStub(IFilesMetadataManager::class)), $this->createStub(ITimeFactory::class));
		return new LibraryController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service);
	}

	// spec: FOLDERS-001.5, FOLDERS-001.8
	public function testScansAndListsTheRoot(): void {
		$scan = $this->controller()->scan('/Photos');
		$this->summaries->rows[10] = new FolderSummary(10, 'e-10', 3, 30, 0, 0, null, null, 9, 1);

		$this->assertSame([Http::STATUS_OK, ['scanning' => ['done' => 1, 'total' => 1]]], [$scan->getStatus(), json_decode($scan->render(), true)]);
		$list = $this->controller()->folders('/Photos');
		$this->assertSame(Http::STATUS_OK, $list->getStatus());
		/** @var array{folders: list<array<string, mixed>>} $body */
		$body = json_decode($list->render(), true);
		$this->assertSame(['fileId' => 10, 'path' => '/Photos', 'undecided' => 3, 'done' => null], array_intersect_key($body['folders'][0], array_flip(['fileId', 'path', 'undecided', 'done'])));
	}

	// spec: FOLDERS-001.13, FOLDERS-001.14
	public function testAForeignRootOrAMalformedPageIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->folders('/Shared')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->scan('/Nope')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->folders('/Photos', '', '500')->getStatus());
		$this->assertSame([], $this->summaries->rows);
	}

	// spec: FOLDERS-001.15
	public function testAnswersUnauthorizedWithoutAUser(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->folders('/Photos')->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->scan('/Photos')->getStatus());
		$this->assertSame([], $this->summaries->rows);
	}

	// spec: FOLDERS-001.16
	public function testRoutesTheListAndTheRateLimitedScan(): void {
		$route = static fn (string $method): array => (new ReflectionMethod(LibraryController::class, $method))->getAttributes(FrontpageRoute::class)[0]->getArguments();
		$limits = (new ReflectionMethod(LibraryController::class, 'scan'))->getAttributes(UserRateLimit::class);

		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/library/folders'], $route('folders'));
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/library/scan'], $route('scan'));
		$this->assertSame(['limit' => 600, 'period' => 60], $limits[0]->getArguments());
	}
}
