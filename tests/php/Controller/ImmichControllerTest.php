<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\ImmichController;
use OCA\Honeycomb\Controller\WriteRateLimit;
use OCA\Honeycomb\Immich\AssetEntries;
use OCA\Honeycomb\Immich\Connections;
use OCA\Honeycomb\Immich\ConnectionsFileShape;
use OCA\Honeycomb\Immich\DecidedPages;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichCounts;
use OCA\Honeycomb\Immich\ImmichDecisions;
use OCA\Honeycomb\Immich\ImmichImages;
use OCA\Honeycomb\Immich\ImmichListing;
use OCA\Honeycomb\Immich\ImmichPictureSource;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ImmichStatus;
use OCA\Honeycomb\Immich\ImmichWrite;
use OCA\Honeycomb\Immich\ImmichWriteCheck;
use OCA\Honeycomb\Immich\ListingCursors;
use OCA\Honeycomb\Tests\Immich\FakeImmichDecisionStore;
use OCA\Honeycomb\Tests\Immich\FakeImmichServer;
use OCA\Honeycomb\Tests\Immich\FakeLocalFiles;
use OCA\Honeycomb\Tests\Immich\FakeLogger;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\DataDisplayResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use OCP\Security\ICrypto;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

final class ImmichControllerTest extends TestCase {
	use FakeImmichServer;

	private const string FILE = '/run/secrets/honeycomb/connections.json';
	private const string ASSET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

	private FakeLocalFiles $files;
	private FakeImmichDecisionStore $decisions;
	private string $configured = self::FILE;

	#[\Override]
	protected function setUp(): void {
		$this->files = new FakeLocalFiles();
		$this->files->files[self::FILE] = json_encode(['version' => 1, 'connections' => [
			['id' => 'alice-phone', 'user' => 'alice', 'label' => 'My phone', 'url' => 'http://immich-server:2283', 'keyFile' => '/keys/alice-phone.key'],
			['id' => 'bob-phone', 'user' => 'bob', 'label' => 'Phone', 'url' => 'http://immich-server:2283', 'keyFile' => '/keys/bob-phone.key'],
		]], JSON_THROW_ON_ERROR);
		$this->files->files['/keys/alice-phone.key'] = 'key-a';
		$this->files->files['/keys/bob-phone.key'] = 'key-b';
		$this->decisions = new FakeImmichDecisionStore();
	}

	public function testTheRoutesAreForSignedInUsersAndOnlyTheImageSkipsTheCsrfCheck(): void {
		$routes = [];
		foreach (['connections', 'status', 'assets', 'image', 'decisions', 'counts', 'writeCheck', 'write'] as $method) {
			$reflection = new ReflectionMethod(ImmichController::class, $method);
			$this->assertNotEmpty($reflection->getAttributes(NoAdminRequired::class));
			$route = $reflection->getAttributes(FrontpageRoute::class)[0]->getArguments();
			$routes[$method] = [$route['verb'], $route['url'], $reflection->getAttributes(NoCSRFRequired::class) !== []];
		}

		$this->assertSame([
			'connections' => ['GET', '/api/v1/immich/connections', false],
			'status' => ['GET', '/api/v1/immich/{connectionId}/status', false],
			'assets' => ['POST', '/api/v1/immich/{connectionId}/assets', false],
			'image' => ['GET', '/api/v1/immich/{connectionId}/assets/{assetId}/image', true],
			'decisions' => ['PUT', '/api/v1/immich/{connectionId}/decisions', false],
			'counts' => ['POST', '/api/v1/immich/{connectionId}/counts', false],
			'writeCheck' => ['POST', '/api/v1/immich/{connectionId}/write/check', false],
			'write' => ['POST', '/api/v1/immich/{connectionId}/write', false],
		], $routes);
	}

	public function testOnlyTheSaveAndTheWriteAreRateLimitedAsAWrite(): void {
		$limits = array_map(static fn (string $method): array => array_map(static fn (\ReflectionAttribute $limit): array => $limit->getArguments(), (new ReflectionMethod(ImmichController::class, $method))->getAttributes(UserRateLimit::class)), ['decisions', 'write', 'counts', 'assets', 'writeCheck']);

		$limit = [['limit' => WriteRateLimit::LIMIT, 'period' => WriteRateLimit::PERIOD_SECONDS]];
		$this->assertSame([$limit, $limit, [], [], []], $limits);
	}

	public function testWithoutAUserEveryRouteIsUnauthorised(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller(false)->connections()->getStatus());
	}

	// spec: IMMICH-001.2
	public function testTheConnectionsAreTheUsersOwn(): void {
		$this->assertAnswer(Http::STATUS_OK, ['connections' => [['id' => 'alice-phone', 'label' => 'My phone', 'url' => 'http://immich-server:2283']]], $this->controller()->connections());
	}

	// spec: IMMICH-001.1
	public function testWithoutTheAppConfigTheConnectionsAreEmpty(): void {
		$this->configured = '';

		$this->assertAnswer(Http::STATUS_OK, ['connections' => []], $this->controller()->connections());
	}

	// spec: IMMICH-001.3
	public function testABrokenFileIsUnavailableWithoutItsPathOrViolation(): void {
		$this->files->files[self::FILE] = '{"version": 2, "connections": []}';

		$this->assertAnswer(Http::STATUS_SERVICE_UNAVAILABLE, ['error' => 'connections-file'], $this->controller()->connections());
	}

	// spec: IMMICH-001.5
	public function testSomeoneElsesConnectionIsUnknownOnEveryRouteBeforeAKeyIsRead(): void {
		$controller = $this->controller();
		foreach ([$controller->status('bob-phone'), $controller->assets('bob-phone'), $controller->image('bob-phone', self::ASSET, 'thumbnail'), $controller->status('nobody'), $controller->counts('bob-phone'), $controller->writeCheck('bob-phone', [self::ASSET]), $controller->write('bob-phone', [['assetId' => self::ASSET, 'immichRating' => null]])] as $answer) {
			$this->assertAnswer(Http::STATUS_NOT_FOUND, ['error' => 'unknown-connection'], $answer);
		}
		$this->assertSame(array_fill(0, 7, self::FILE), $this->files->reads);
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-003.6
	public function testASaveForSomeoneElsesConnectionIsUnknownAndSavesNothing(): void {
		$this->assertAnswer(Http::STATUS_NOT_FOUND, ['error' => 'unknown-connection'], $this->controller()->decisions('bob-phone', [$this->decision()]));
		$this->assertSame([], $this->decisions->rows);
	}

	// spec: IMMICH-003.7
	public function testASaveWhileImmichIsDownSucceedsWithoutAskingIt(): void {
		$this->immichDown('GET /server/version');
		$this->immichDown('POST /search/metadata');

		$this->assertAnswer(Http::STATUS_OK, ['saved' => [self::ASSET]], $this->controller()->decisions('alice-phone', [$this->decision()]));
		$this->assertSame([], $this->immichRequests);
		$this->assertCount(1, $this->decisions->rows);
	}

	// spec: IMMICH-003.5
	public function testAMalformedSaveIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->decisions('alice-phone', [[...$this->decision(), 'rating' => 6]]));
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->decisions('alice-phone'));
	}

	// spec: IMMICH-002.25
	public function testAMalformedCountsRequestIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->counts('alice-phone', ['kinds' => ['screenshot']]));
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-001.8
	public function testAnUnreachableImmichFailsTheListingButTheStatusReports(): void {
		$this->immichDown('GET /server/version');
		$this->immichDown('POST /search/metadata');

		$this->assertAnswer(Http::STATUS_BAD_GATEWAY, ['error' => 'unreachable'], $this->controller()->assets('alice-phone'));
		$this->assertAnswer(Http::STATUS_OK, ['state' => 'unreachable', 'account' => null, 'version' => null, 'total' => null], $this->controller()->status('alice-phone'));
	}

	// spec: IMMICH-002.5
	public function testAMalformedListingIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->assets('alice-phone', ['kinds' => ['screenshot']]));
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->assets('alice-phone', [], null, 251));
	}

	// spec: IMMICH-002.35
	public function testAMalformedFromIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->assets('alice-phone', [], null, 10, ['assetId' => 'not-an-id', 'takenAt' => 1]));
	}

	// spec: IMMICH-002.16
	public function testAPreviewIsImmichsImageCachedForAYear(): void {
		$this->immichRoute('GET /assets/' . self::ASSET . '/thumbnail', static fn (array $options): array => [200, 'webp-' . json_encode($options['query'] ?? null, JSON_THROW_ON_ERROR), 'image/webp']);

		$answer = $this->controller()->image('alice-phone', self::ASSET, 'thumbnail');

		$this->assertInstanceOf(DataDisplayResponse::class, $answer);
		$this->assertSame('webp-{"size":"thumbnail"}', $answer->getData());
		/** @var array<string, string> $headers */
		$headers = (new \ReflectionProperty(Response::class, 'headers'))->getValue($answer);
		$this->assertSame(['image/webp', 'private, max-age=31536000, immutable'], [$headers['Content-Type'], $headers['Cache-Control']]);
	}

	// spec: IMMICH-001.9
	public function testAPreviewWithoutAssetViewNamesTheScope(): void {
		$this->immichAnswers('GET /assets/' . self::ASSET . '/thumbnail', 403);

		$this->assertAnswer(Http::STATUS_FORBIDDEN, ['error' => 'scope', 'scope' => 'asset.view'], $this->controller()->image('alice-phone', self::ASSET, 'thumbnail'));
	}

	// spec: IMMICH-002.20
	public function testAPreviewOfAnUnknownAssetIsNotFound(): void {
		$this->assertAnswer(Http::STATUS_NOT_FOUND, ['error' => 'unknown-asset'], $this->controller()->image('alice-phone', self::ASSET, 'preview'));
	}

	public function testAPreviewOfAnotherSizeOrAMalformedIdIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->image('alice-phone', self::ASSET, 'original'));
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->image('alice-phone', '../users/me', 'thumbnail'));
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-004.18
	public function testTheWriteCheckAnswersImmichsStateOfTheAssets(): void {
		$asset = ['id' => self::ASSET, 'updatedAt' => '2026-11-21T20:33:35.789Z', 'isFavorite' => true, 'isTrashed' => false, 'visibility' => 'timeline', 'stack' => null, 'exifInfo' => ['rating' => 4]];
		$this->immichAnswers('POST /search/metadata', 200, ['assets' => ['items' => [$asset], 'nextCursor' => null]]);
		$this->immichAnswers('GET /albums', 200, []);

		$this->assertAnswer(Http::STATUS_OK, ['assets' => [[
			'assetId' => self::ASSET, 'updatedAt' => '2026-11-21T20:33:35.789Z', 'rating' => 4, 'favorite' => true, 'trashed' => false,
			'archived' => false, 'sharedAlbum' => null, 'stackSize' => null,
		]]], $this->controller()->writeCheck('alice-phone', [self::ASSET]));
	}

	// spec: IMMICH-004.18
	public function testAMalformedWriteCheckIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->writeCheck('alice-phone', null));
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-004.19
	public function testTheWriteAnswersEachAssetsResult(): void {
		$this->controller()->decisions('alice-phone', [$this->decision()]);
		$this->immichAnswers('PUT /assets/' . self::ASSET, 200, ['id' => self::ASSET]);

		$this->assertAnswer(Http::STATUS_OK, ['results' => [['assetId' => self::ASSET, 'state' => 'written']]], $this->controller()->write('alice-phone', [['assetId' => self::ASSET, 'favorite' => true, 'immichRating' => 3]]));
		$this->assertSame(['isFavorite' => true], $this->lastImmichBody('PUT /assets/' . self::ASSET));
	}

	// spec: IMMICH-004.2
	public function testAWriteAskingForForceIsABadRequest(): void {
		$this->assertAnswer(Http::STATUS_BAD_REQUEST, ['error' => 'request'], $this->controller()->write('alice-phone', [['assetId' => self::ASSET, 'trash' => true, 'force' => true, 'immichRating' => null]]));
		$this->assertSame([], $this->immichRequests);
	}

	/** @return array<string, mixed> */
	private function decision(): array {
		return ['assetId' => self::ASSET, 'rating' => 3, 'colourLabel' => null, 'flag' => 'picked', 'keepRaw' => false, 'takenAt' => 1_794_990_000, 'cameraModel' => null, 'kind' => 'photo', 'assetUpdatedAt' => '2026-11-19T08:00:00.000Z'];
	}

	/** @param array<string, mixed> $body */
	private function assertAnswer(int $status, array $body, Response $answer): void {
		$this->assertInstanceOf(JSONResponse::class, $answer);
		$this->assertSame([$status, $body], [$answer->getStatus(), $answer->getData()]);
	}

	private function controller(bool $loggedIn = true): ImmichController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(fn (): string => $this->configured);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(1_795_000_000);
		$crypto = $this->createStub(ICrypto::class);
		$crypto->method('calculateHMAC')->willReturnCallback(static fn (string $message): string => hash_hmac('sha256', $message, 'secret'));
		$logger = new FakeLogger();
		$client = new ImmichClient($this->immichClients(), $this->files, $logger);
		$filter = new ImmichSearchFilter();
		$cursors = new ListingCursors($crypto);
		$entries = new AssetEntries();
		return new ImmichController(
			'honeycomb',
			$this->createStub(IRequest::class),
			new ApiResponse($session),
			new Connections($config, $this->files, new ConnectionsFileShape(), $logger),
			new ImmichStatus($client, $filter),
			new ImmichPictureSource(
				new ImmichListing($client, $filter, $cursors, $entries, $time, $this->decisions, new DecidedPages($client, $filter, $cursors, $entries, $this->decisions)),
				new ImmichCounts($client, $filter, $this->decisions, $time),
				new ImmichImages($client),
				new ImmichDecisions($this->decisions, $time),
			),
			new ImmichWriteCheck($client, $filter),
			new ImmichWrite($client, $this->decisions),
		);
	}
}
