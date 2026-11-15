<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\LegacyController;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\LegacyService;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\UserFolderResolver;
use OCA\Honeycomb\Service\UserPhotos;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCA\Honeycomb\Tests\Service\FakeFiles;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
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

final class LegacyControllerTest extends TestCase {
	use FakeFiles;

	/** The photos alice reaches, by file id. */
	private const array PHOTOS = [1 => '/Photos/A/IMG_1.JPG', 2 => '/Photos/A/IMG_2.JPG', 3 => '/Photos/B/IMG_3.JPG'];

	/** A file id alice no longer reaches. */
	private const int GONE = 70;

	/** Another file id alice no longer reaches. */
	private const int OTHER_GONE = 71;

	private FakeDecisionStore $decisions;
	private FakeTagStore $tags;

	#[\Override]
	protected function setUp(): void {
		$this->decisions = new FakeDecisionStore();
		$this->tags = new FakeTagStore();
	}

	private function controller(bool $loggedIn = true): LegacyController {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $this->user() : null);
		$userFolder = $this->folder('');
		$userFolder->method('getFirstNodeById')->willReturnCallback(
			fn (int $id): ?Node => isset(self::PHOTOS[$id]) ? $this->file($id, self::PHOTOS[$id]) : null,
		);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$service = new LegacyService($this->decisions, $this->tags, new UserPhotos(new UserFolderResolver($root)));
		return new LegacyController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $service);
	}

	private function decide(string $userId, int $fileId): void {
		$this->decisions->rows[$userId][$fileId] = new PictureDecision($fileId, 3, ColourLabel::Green, Flag::Picked, false);
	}

	private function tag(string $userId, int $fileId): void {
		$this->tags->replace($userId, [], [new PictureTags($fileId, ['Anna'])]);
	}

	/** @return array<string, mixed> */
	private static function body(Response $response): array {
		return json_decode($response->render(), true, flags: JSON_THROW_ON_ERROR);
	}

	// spec: XMP-007.1
	public function testNamesTheFoldersWithLegacyRowsAndCountsTheUnreachable(): void {
		$this->decide('alice', 1);
		$this->decide('alice', 2);
		$this->tag('alice', 2);
		$this->tag('alice', 3);
		$this->decide('alice', self::GONE);
		$this->decide('bob', 3);

		$response = $this->controller()->folders();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(
			['folders' => [['path' => '/Photos/A', 'files' => 2], ['path' => '/Photos/B', 'files' => 1]], 'unreachable' => 1],
			self::body($response),
		);
	}

	// spec: XMP-007.2
	public function testExportsTheRowsOfTheUnreachableFileIdsOnly(): void {
		$this->decide('alice', 1);
		$this->tag('alice', 1);
		$this->decide('alice', self::GONE);
		$this->tag('alice', self::OTHER_GONE);

		$response = $this->controller()->export();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(
			[
				'decisions' => [['fileId' => self::GONE, 'rating' => 3, 'colourLabel' => 'green', 'flag' => 'picked', 'keepRaw' => false]],
				'tags' => [['fileId' => self::OTHER_GONE, 'tags' => ['Anna']]],
			],
			self::body($response),
		);
	}

	// spec: XMP-007.3
	public function testAcknowledgingRemovesOnlyTheUsersRowsOfThoseFileIds(): void {
		foreach ([1, 2] as $fileId) {
			$this->decide('alice', $fileId);
			$this->tag('alice', $fileId);
			$this->decide('bob', $fileId);
			$this->tag('bob', $fileId);
		}

		$response = $this->controller()->acknowledge([1]);

		$this->assertSame(Http::STATUS_NO_CONTENT, $response->getStatus());
		$this->assertSame([2], array_keys($this->decisions->rows['alice']));
		$this->assertSame([2], array_keys($this->tags->rows['alice']));
		$this->assertSame([1, 2], array_keys($this->decisions->rows['bob']));
		$this->assertSame([1, 2], array_keys($this->tags->rows['bob']));
		$this->assertSame(['Anna'], $this->tags->tagList('alice'));
	}

	/** @return array<string, array{list<mixed>}> */
	public static function malformed(): array {
		return [
			'a string id' => [['1']],
			'a zero id' => [[0]],
			'too many ids' => [array_fill(0, 60_001, 1)],
		];
	}

	// spec: XMP-007.4
	/** @param list<mixed> $fileIds */
	#[DataProvider('malformed')]
	public function testAnswersBadRequestForAMalformedAcknowledgementAndRemovesNothing(array $fileIds): void {
		$this->decide('alice', 1);

		$response = $this->controller()->acknowledge($fileIds);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame([1], array_keys($this->decisions->rows['alice']));
	}

	/** @return array<string, array{\Closure(LegacyController): Response}> */
	public static function routes(): array {
		return [
			'folders' => [static fn (LegacyController $c) => $c->folders()],
			'export' => [static fn (LegacyController $c) => $c->export()],
			'acknowledge' => [static fn (LegacyController $c) => $c->acknowledge([1])],
		];
	}

	// spec: XMP-007.4
	/** @param \Closure(LegacyController): Response $call */
	#[DataProvider('routes')]
	public function testAnswersUnauthorizedWithoutAUser(\Closure $call): void {
		$this->decide('alice', 1);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $call($this->controller(false))->getStatus());
		$this->assertSame([1], array_keys($this->decisions->rows['alice']));
	}

	/** @return array<string, array{string, string, string, bool}> */
	public static function attributes(): array {
		return [
			'folders' => ['folders', 'GET', '/api/v1/legacy/folders', false],
			'export' => ['export', 'GET', '/api/v1/legacy/export', false],
			'acknowledge' => ['acknowledge', 'DELETE', '/api/v1/legacy', true],
		];
	}

	// spec: XMP-007.4
	#[DataProvider('attributes')]
	public function testRoutesForUsersWithCsrfCheck(string $method, string $verb, string $url, bool $rateLimited): void {
		$reflection = new ReflectionMethod(LegacyController::class, $method);
		$route = $reflection->getAttributes(FrontpageRoute::class)[0]->getArguments();

		$this->assertSame(['verb' => $verb, 'url' => $url], $route);
		$this->assertCount(1, $reflection->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $reflection->getAttributes(NoCSRFRequired::class));
		$this->assertCount($rateLimited ? 1 : 0, $reflection->getAttributes(UserRateLimit::class));
	}
}
