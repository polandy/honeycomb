<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\Limits;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichDecisions;
use OCA\Honeycomb\Immich\ImmichError;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichDecisionsTest extends TestCase {
	use AssertsImmichFailure;

	private const int NOW = 1_795_000_000;
	private const string ASSET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
	private const array DECISION = [
		'assetId' => self::ASSET, 'rating' => 3, 'colourLabel' => 'red', 'flag' => 'picked', 'keepRaw' => false,
		'takenAt' => 1_794_990_000, 'cameraModel' => 'Pixel 9 Pro', 'kind' => 'live', 'assetUpdatedAt' => '2026-11-19T08:00:00.000Z',
	];

	private FakeImmichDecisionStore $store;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeImmichDecisionStore();
	}

	// spec: IMMICH-003.1
	public function testTheSaveAnswersTheAssetIdsAndKeepsTheWholeDecision(): void {
		$this->assertSame(['saved' => [self::ASSET]], $this->decisions()->save($this->connection(), [self::DECISION]));

		$this->assertEquals(['user' => 'alice', 'connection' => 'alice-phone', 'updatedAt' => self::NOW,
			'decision' => new AssetDecision(self::ASSET, 3, ColourLabel::Red, Flag::Picked, false, 1_794_990_000, 'Pixel 9 Pro', AssetKind::Live, '2026-11-19T08:00:00.000Z'),
		], $this->store->rows['alice-phone/' . self::ASSET]);
	}

	// spec: IMMICH-003.3
	public function testALaterSaveReplacesTheWholeStateWithTheClocksTime(): void {
		$this->decisions()->save($this->connection(), [self::with(['rating' => 4])]);

		$this->decisions(self::NOW + 60)->save($this->connection(), [self::with(['rating' => 0, 'colourLabel' => null, 'flag' => 'unflagged', 'cameraModel' => null])]);

		$row = $this->store->rows['alice-phone/' . self::ASSET];
		$this->assertSame([0, null, Flag::Unflagged, null, self::NOW + 60], [$row['decision']->rating, $row['decision']->colourLabel, $row['decision']->flag, $row['decision']->cameraModel, $row['updatedAt']]);
	}

	// spec: IMMICH-003.17
	public function testAnAssetNamedTwiceKeepsItsLastDecision(): void {
		$answer = $this->decisions()->save($this->connection(), [self::DECISION, self::with(['flag' => 'rejected'])]);

		$this->assertSame(['saved' => [self::ASSET]], $answer);
		$this->assertSame(Flag::Rejected, $this->store->rows['alice-phone/' . self::ASSET]['decision']->flag);
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		$without = self::DECISION;
		unset($without['assetUpdatedAt']);
		return [
			'no list' => [['decisions' => self::DECISION]],
			'a decision that is no object' => [['x']],
			'an asset id that is no UUID' => [[self::with(['assetId' => '../users/me'])]],
			'an asset id in upper case' => [[self::with(['assetId' => strtoupper(self::ASSET)])]],
			'a rating above 5' => [[self::with(['rating' => 6])]],
			'a rating below 0' => [[self::with(['rating' => -1])]],
			'an unknown colour label' => [[self::with(['colourLabel' => 'purple'])]],
			'an unknown flag' => [[self::with(['flag' => 'maybe'])]],
			'an unknown kind' => [[self::with(['kind' => 'screenshot'])]],
			'a takenAt that is no integer' => [[self::with(['takenAt' => '1794990000'])]],
			'a keepRaw that is no boolean' => [[self::with(['keepRaw' => 0])]],
			'an empty camera model' => [[self::with(['cameraModel' => ''])]],
			'an empty updatedAt' => [[self::with(['assetUpdatedAt' => ''])]],
			'a missing field' => [[$without]],
			'an unknown field' => [[self::with(['rejected' => true])]],
			'a good decision beside a bad one' => [[self::DECISION, self::with(['rating' => 9])]],
		];
	}

	// spec: IMMICH-003.5
	#[DataProvider('malformed')]
	public function testAMalformedBodyIsABadRequestAndSavesNothing(mixed $decisions): void {
		$this->assertFailsWith(ImmichError::Request, fn () => $this->decisions()->save($this->connection(), $decisions));
		$this->assertSame([], $this->store->rows);
	}

	// spec: IMMICH-003.5
	public function testMoreDecisionsThanTheLimitAreABadRequest(): void {
		$this->assertFailsWith(ImmichError::Request, fn () => $this->decisions()->save($this->connection(), array_fill(0, Limits::ENTRIES + 1, self::DECISION)));
		$this->assertSame([], $this->store->rows);
	}

	// spec: IMMICH-003.8
	public function testTheSameAssetUnderAnotherConnectionStaysApart(): void {
		$this->decisions()->save($this->connection(), [self::DECISION]);

		$this->assertSame([], $this->store->find('alice', 'alice-tablet', [self::ASSET]));
	}

	/**
	 * The decision with the given fields replaced.
	 * @param array<string, mixed> $fields
	 * @return array<string, mixed>
	 */
	private static function with(array $fields): array {
		return array_replace(self::DECISION, $fields);
	}

	private function decisions(int $now = self::NOW): ImmichDecisions {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn($now);
		return new ImmichDecisions($this->store, $time);
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}
}
