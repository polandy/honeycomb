<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\LibraryController;
use OCA\Honeycomb\Domain\FolderDone;
use OCA\Honeycomb\Domain\FolderSummary;
use OCA\Honeycomb\Domain\LibraryFolder;
use OCA\Honeycomb\Service\Files\UserFolderResolver;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Folder\FolderDoneService;
use OCA\Honeycomb\Service\Folder\LibraryFolderService;
use OCA\Honeycomb\Service\Listing\CaptureTimes;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeFolderDoneStore;
use OCA\Honeycomb\Tests\Service\FakeFolderSummaryStore;
use OCA\Honeycomb\Tests\Service\FakeLibraryFiles;
use OCA\Honeycomb\Tests\Service\Settings\FakeRoots;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Constants;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class LibraryControllerTest extends TestCase {
	use FakeFiles;
	use FakeRoots;
	use StatsFixture;

	private FakeFolderSummaryStore $summaries;
	private FakeFolderDoneStore $done;

	#[\Override]
	protected function setUp(): void {
		$this->summaries = new FakeFolderSummaryStore();
		$this->done = new FakeFolderDoneStore();
	}

	/** @param list<string> $roots */
	private function controller(?IUser $user = null, bool $loggedIn = true, array $roots = []): LibraryController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? ($user ?? $this->user()) : null);
		$files = new FakeLibraryFiles();
		$files->folders = [new LibraryFolder(10, '', 'e-10', Constants::PERMISSION_ALL)];
		$root = $this->rootWith(['/Photos' => $this->folder('/Photos', fileId: 10), '/Shared' => $this->folder('/Shared', mountType: 'shared'), '/Locked' => $this->folder('/Locked', readable: false), '/ReadOnly' => $this->folder('/ReadOnly', fileId: 11, permissions: Constants::PERMISSION_READ)]);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(1_772_407_800);
		$service = new LibraryFolderService(new UserFolderResolver($root), $files, $this->summaries, $this->done, new CaptureTimes($this->createStub(IFilesMetadataManager::class)), $this->noBackfill(), $time);
		$done = new FolderDoneService(new UserPhotos(new UserFolderResolver($root)), $this->done, $time, $this->stats());
		return new LibraryController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service, $this->rootsGuard($roots), $done);
	}

	// spec: FOLDERS-005.5, FOLDERS-005.8
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

	// spec: FOLDERS-006.14
	public function testListsADoneStatusWithoutItsName(): void {
		$this->summaries->rows[10] = new FolderSummary(10, 'e-10', 3, 30, 0, 0, null, null, 9, 1);
		$this->done->rows[10] = new FolderDone(10, null, 1_772_000_000, 3);

		/** @var array{folders: list<array<string, mixed>>} $body */
		$body = json_decode($this->controller()->folders('/Photos')->render(), true);

		$this->assertSame(['by' => null, 'at' => 1_772_000_000, 'photos' => 3], $body['folders'][0]['done']);
	}

	// spec: FOLDERS-005.13, FOLDERS-005.14
	public function testAForeignRootOrAMalformedPageIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->folders('/Shared')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->scan('/Nope')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->folders('/Photos', '', '500')->getStatus());
		$this->assertSame([], $this->summaries->rows);
	}

	// spec: FOLDERS-005.13
	public function testAnUnreadableRootIsForbidden(): void {
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller()->folders('/Locked')->getStatus());
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller()->scan('/Locked')->getStatus());
	}

	// spec: FOLDERS-005.15
	public function testAnswersUnauthorizedWithoutAUser(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->folders('/Photos')->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->scan('/Photos')->getStatus());
		$this->assertSame([], $this->summaries->rows);
	}

	// spec: FOLDERS-005.16
	public function testRoutesTheListAndTheRateLimitedScan(): void {
		$route = static fn (string $method): array => (new ReflectionMethod(LibraryController::class, $method))->getAttributes(FrontpageRoute::class)[0]->getArguments();
		$limits = (new ReflectionMethod(LibraryController::class, 'scan'))->getAttributes(UserRateLimit::class);

		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/library/folders'], $route('folders'));
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/library/scan'], $route('scan'));
		$this->assertSame(['limit' => 600, 'period' => 60], $limits[0]->getArguments());
	}

	/** @return array<string, array{string}> */
	public static function outsideRoots(): array {
		return ['the home folder' => ['/'], 'a sibling sharing the prefix' => ['/Photos-old'], 'a parent segment' => ['/Photos/../Other'], 'a removed root' => ['/Archive']];
	}

	// spec: FOLDERS-005.20
	#[DataProvider('outsideRoots')]
	public function testAFolderOutsideTheLibraryRootsIsNeitherListedNorScanned(string $root): void {
		$controller = $this->controller(roots: ['/Photos']);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->folders($root)->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->scan($root)->getStatus());
		$this->assertSame([], $this->summaries->rows);
	}

	// spec: FOLDERS-005.20
	public function testAFolderInsideALibraryRootIsListedAndScanned(): void {
		$controller = $this->controller(roots: ['/Photos']);

		$this->assertSame(Http::STATUS_OK, $controller->folders('/Photos')->getStatus());
		$this->assertSame(Http::STATUS_OK, $controller->scan('/Photos')->getStatus());
	}

	// spec: FOLDERS-005.21
	public function testChecksACandidateRootWithoutListingIt(): void {
		$route = (new ReflectionMethod(LibraryController::class, 'checkRoot'))->getAttributes(FrontpageRoute::class)[0]->getArguments();

		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/library/root'], $route);
		$ok = $this->controller(roots: ['/Archive'])->checkRoot('/Photos');
		$this->assertSame([Http::STATUS_NO_CONTENT, ''], [$ok->getStatus(), $ok->render()]);
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->checkRoot('/Shared')->getStatus());
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller()->checkRoot('/Locked')->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->checkRoot('/Photos')->getStatus());
	}

	// spec: FOLDERS-006.1, FOLDERS-006.3
	public function testMarksAFolderDoneAndReopensIt(): void {
		$marked = $this->controller()->markDone(10, 412);
		$this->assertSame([Http::STATUS_OK, ['fileId' => 10, 'done' => ['by' => 'alice', 'at' => 1_772_407_800, 'photos' => 412]]], [$marked->getStatus(), json_decode($marked->render(), true)]);
		$this->assertEquals([10 => new FolderDone(10, 'alice', 1_772_407_800, 412)], $this->done->rows);

		foreach ([1, 2] as $_) {
			$this->assertSame(Http::STATUS_NO_CONTENT, $this->controller()->reopen(10)->getStatus());
		}
		$this->assertSame([], $this->done->rows);
	}

	// spec: FOLDERS-006.4, FOLDERS-006.5, FOLDERS-006.6
	public function testAnswersTheErrorsOfTheDoneWrites(): void {
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller()->markDone(11, 3)->getStatus());
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller()->reopen(11)->getStatus());
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller()->markDone(99, 3)->getStatus());
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller()->reopen(99)->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->markDone(10, -1)->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->markDone(10)->getStatus());
		$this->assertSame([], $this->done->rows);
		$this->assertSame([], $this->counted());
	}

	// spec: FOLDERS-006.7
	public function testTheDoneWritesAnswerUnauthorizedWithoutAUser(): void {
		$this->done->rows[10] = new FolderDone(10, 'bob', 5, 1);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->markDone(10, 3)->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->reopen(10)->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->markAllDone([['fileId' => 10, 'photos' => 3]])->getStatus());
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(loggedIn: false)->reopenAll([10])->getStatus());
		$this->assertEquals([10 => new FolderDone(10, 'bob', 5, 1)], $this->done->rows);
	}

	// spec: FOLDERS-006.8
	public function testRoutesTheDoneWritesWithTheRateLimit(): void {
		$route = static fn (string $method): array => (new ReflectionMethod(LibraryController::class, $method))->getAttributes(FrontpageRoute::class)[0]->getArguments();
		$limit = static fn (string $method): array => (new ReflectionMethod(LibraryController::class, $method))->getAttributes(UserRateLimit::class)[0]->getArguments();

		$this->assertSame(['verb' => 'PUT', 'url' => '/api/v1/library/folders/{fileId}/done'], $route('markDone'));
		$this->assertSame(['verb' => 'DELETE', 'url' => '/api/v1/library/folders/{fileId}/done'], $route('reopen'));
		$this->assertSame(['limit' => 600, 'period' => 60], $limit('markDone'));
		$this->assertSame(['limit' => 600, 'period' => 60], $limit('reopen'));
		$this->assertSame(['verb' => 'PUT', 'url' => '/api/v1/library/done'], $route('markAllDone'));
		$this->assertSame(['verb' => 'DELETE', 'url' => '/api/v1/library/done'], $route('reopenAll'));
		$this->assertSame(['limit' => 600, 'period' => 60], $limit('markAllDone'));
		$this->assertSame(['limit' => 600, 'period' => 60], $limit('reopenAll'));
	}

	// spec: FOLDERS-006.15, FOLDERS-006.18, FOLDERS-009.17
	public function testMarksABatchDoneAndReopensIt(): void {
		$marked = $this->controller()->markAllDone([['fileId' => 10, 'photos' => 412], ['fileId' => 11, 'photos' => 2]]);

		$this->assertSame([Http::STATUS_OK, [
			'done' => [['fileId' => 10, 'done' => ['by' => 'alice', 'at' => 1_772_407_800, 'photos' => 412]]],
			'skipped' => [['fileId' => 11, 'reason' => 'read-only']],
		]], [$marked->getStatus(), json_decode($marked->render(), true)]);
		$this->assertSame(Http::STATUS_NO_CONTENT, $this->controller()->reopenAll([10])->getStatus());
		$this->assertSame([], $this->done->rows);
	}

	// spec: FOLDERS-006.16, FOLDERS-006.17, FOLDERS-009.17
	public function testAnswersTheErrorsOfTheBatchWrites(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->markAllDone(array_fill(0, 501, ['fileId' => 10, 'photos' => 1]))->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->markAllDone()->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->reopenAll()->getStatus());
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller()->markAllDone([['fileId' => 99, 'photos' => 1]])->getStatus());
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller()->reopenAll([11])->getStatus());
		$this->assertSame([], $this->done->rows);
		$this->assertSame([], $this->counted());
	}
}
