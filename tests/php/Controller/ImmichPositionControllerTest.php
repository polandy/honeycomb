<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\PositionController;
use OCA\Honeycomb\Domain\FolderSet;
use OCA\Honeycomb\Domain\ResumePosition;
use OCA\Honeycomb\Immich\Connections;
use OCA\Honeycomb\Immich\ConnectionsFileShape;
use OCA\Honeycomb\Immich\ImmichPosition;
use OCA\Honeycomb\Immich\ImmichPositions;
use OCA\Honeycomb\Service\Folder\PositionService;
use OCA\Honeycomb\Tests\Immich\FakeImmichPositionStore;
use OCA\Honeycomb\Tests\Immich\FakeLocalFiles;
use OCA\Honeycomb\Tests\Immich\FakeLogger;
use OCA\Honeycomb\Tests\Service\FakePositionStore;
use OCA\Honeycomb\Tests\Service\StatsFixture;
use OCP\AppFramework\Http;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

/** A connection's resume position through the positions endpoint (IMMICH-003, ADR 0044). */
final class ImmichPositionControllerTest extends TestCase {
	use StatsFixture;

	private const int NOW = 1_795_000_000;
	private const string PATH = '/run/secrets/honeycomb/connections.json';
	private const string ASSET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

	private FakePositionStore $folderPositions;
	private FakeImmichPositionStore $immichPositions;
	private int $now = self::NOW;

	#[\Override]
	protected function setUp(): void {
		$this->folderPositions = new FakePositionStore();
		$this->immichPositions = new FakeImmichPositionStore();
	}

	// spec: IMMICH-003.14
	public function testAConnectionsPositionIsSavedAndListedWithItsAssetAndCaptureTime(): void {
		$saved = $this->controller()->save(decided: 600, total: 1000, immich: 'alice-phone', assetId: self::ASSET, takenAt: 1_794_000_000);
		$position = ['immich' => 'alice-phone', 'assetId' => self::ASSET, 'takenAt' => 1_794_000_000, 'decided' => 600, 'total' => 1000, 'updatedAt' => self::NOW];

		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame($position, json_decode($saved->render(), true));
		$this->assertSame(['positions' => [$position]], json_decode($this->controller()->index()->render(), true));
	}

	// spec: IMMICH-003.15
	public function testTheListHoldsConnectionsAndFolderSetsNewestFirst(): void {
		$this->folderPositions->save('alice', new ResumePosition(new FolderSet(['/Trip'], false), 12, 3, 10, self::NOW - 20));
		$this->controller()->save(decided: 1, total: 2, immich: 'alice-phone', assetId: self::ASSET, takenAt: 1);
		$this->folderPositions->save('alice', new ResumePosition(new FolderSet(['/Home'], false), 13, 0, 4, self::NOW + 5));

		/** @var array{positions: list<array<string, mixed>>} $listed */
		$listed = json_decode($this->controller()->index()->render(), true);

		$this->assertSame([self::NOW + 5, self::NOW, self::NOW - 20], array_column($listed['positions'], 'updatedAt'));
		$this->assertSame([13, 12], array_column($listed['positions'], 'fileId'));
		$this->assertSame('alice-phone', $listed['positions'][1]['immich']);
	}

	// spec: IMMICH-003.23
	public function testOnePositionPerConnectionOutsideTheFolderSetsLimitAndWithoutActiveTime(): void {
		foreach (range(1, PositionService::RECENT_LIMIT) as $n) {
			$this->folderPositions->save('alice', new ResumePosition(new FolderSet(["/F$n"], false), $n, 0, 1, self::NOW - 100 + $n));
		}

		$this->controller()->save(decided: 1, total: 9, activeSeconds: 90, immich: 'alice-phone', assetId: self::ASSET, takenAt: 1);
		$this->now++;
		$this->controller()->save(decided: 2, total: 9, activeSeconds: 90, immich: 'alice-phone', assetId: self::ASSET, takenAt: 1);

		$this->assertSame([2], array_map(static fn (ImmichPosition $position): int => $position->decided, $this->immichPositions->all('alice')));
		$this->assertCount(PositionService::RECENT_LIMIT, $this->folderPositions->all('alice'));
		$this->assertSame([], $this->statsStore()->rows);
	}

	// spec: IMMICH-003.24
	public function testAMalformedPositionIsABadRequestAndAnotherUsersConnectionIsUnknown(): void {
		foreach ([['not-a-uuid', 1, 0, 1], [self::ASSET, -1, 0, 1], [self::ASSET, 1, 2, 1], [self::ASSET, 1, -1, 1]] as [$assetId, $takenAt, $decided, $total]) {
			$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->save(decided: $decided, total: $total, immich: 'alice-phone', assetId: $assetId, takenAt: $takenAt)->getStatus());
		}
		$unknown = $this->controller()->save(decided: 0, total: 1, immich: 'handed-over', assetId: self::ASSET, takenAt: 1);

		$this->assertSame(Http::STATUS_NOT_FOUND, $unknown->getStatus());
		$this->assertSame('unknown-connection', json_decode($unknown->render(), true)['error'] ?? null);
		$this->assertSame([], $this->immichPositions->rows);
	}

	private function controller(): PositionController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->now);
		$files = new FakeLocalFiles();
		$files->files[self::PATH] = json_encode(['version' => 1, 'connections' => [
			['id' => 'alice-phone', 'user' => 'alice', 'label' => 'Phone', 'url' => 'http://immich-server:2283', 'keyFile' => '/run/secrets/honeycomb/alice-phone.key'],
			['id' => 'handed-over', 'user' => 'bob', 'label' => 'Camera', 'url' => 'http://immich-server:2283', 'keyFile' => '/run/secrets/honeycomb/handed-over.key'],
		]], JSON_THROW_ON_ERROR);
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(static fn (string $app, string $key): string => $key === 'connections_file' ? self::PATH : '');
		$connections = new Connections($config, $files, new ConnectionsFileShape(), new FakeLogger());
		return new PositionController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), new PositionService($this->folderPositions, $time, $this->stats()), new ImmichPositions($this->immichPositions, $connections, $time));
	}
}
