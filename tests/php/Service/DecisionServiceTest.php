<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\DecisionService;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\InvalidDecisionException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\PictureDecision;
use OCP\DB\Exception as DbException;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class DecisionServiceTest extends TestCase {
	private FakeDecisionStore $store;
	private DecisionService $service;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeDecisionStore();
		$this->service = new DecisionService($this->store);
	}

	private function user(string $uid): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	/** @return array<string, mixed> */
	private static function item(int $fileId, int $rating = 0, ?string $colourLabel = null, string $flag = 'unflagged', bool $keepRaw = false): array {
		return ['fileId' => $fileId, 'rating' => $rating, 'colourLabel' => $colourLabel, 'flag' => $flag, 'keepRaw' => $keepRaw];
	}

	// spec: DECISIONS-001.2
	public function testStoresTheDecisionsOfEveryMember(): void {
		$this->service->save($this->user('alice'), [self::item(1, 4, 'green', 'picked'), self::item(2, 4, 'green', 'picked')]);

		$this->assertEquals(
			[new PictureDecision(1, 4, ColourLabel::Green, Flag::Picked, false), new PictureDecision(2, 4, ColourLabel::Green, Flag::Picked, false)],
			$this->service->lookup($this->user('alice'), [1, 2, 3]),
		);
	}

	// spec: DECISIONS-001.1
	public function testReturnsOnlyTheDecisionsOfTheAskedFileIds(): void {
		$this->service->save($this->user('alice'), [self::item(1, 2), self::item(2, 3)]);

		$this->assertEquals([new PictureDecision(2, 3, null, Flag::Unflagged, false)], $this->service->lookup($this->user('alice'), [2]));
	}

	// spec: DECISIONS-001.4
	public function testKeepsTheDecisionsOfEachUserApart(): void {
		$this->service->save($this->user('alice'), [self::item(1, flag: 'rejected')]);
		$this->service->save($this->user('bob'), [self::item(1, flag: 'picked')]);

		$this->assertSame(Flag::Rejected, $this->service->lookup($this->user('alice'), [1])[0]->flag);
		$this->assertSame(Flag::Picked, $this->service->lookup($this->user('bob'), [1])[0]->flag);
	}

	// spec: DECISIONS-001.2
	public function testOverwritesTheWholeEarlierState(): void {
		$this->service->save($this->user('alice'), [self::item(1, 5, 'red', 'picked', true)]);

		$this->service->save($this->user('alice'), [self::item(1, flag: 'rejected')]);

		$this->assertEquals([new PictureDecision(1, 0, null, Flag::Rejected, false)], $this->service->lookup($this->user('alice'), [1]));
	}

	// spec: DECISIONS-001.3
	public function testRemovesTheRowOfADecisionBackToTheDefault(): void {
		$this->service->save($this->user('alice'), [self::item(1, 3), self::item(2, 3)]);

		$this->service->save($this->user('alice'), [self::item(1)]);

		$this->assertCount(1, $this->store->rows['alice']);
		$this->assertArrayNotHasKey(1, $this->store->rows['alice']);
	}

	// spec: DECISIONS-001.13
	public function testSavesAgainWhenAConcurrentSaveWonTheInsert(): void {
		$this->store->failures = 1;

		$this->service->save($this->user('alice'), [self::item(1, 4)]);

		$this->assertSame(2, $this->store->replaceCalls);
		$this->assertSame(4, $this->service->lookup($this->user('alice'), [1])[0]->rating);
	}

	// spec: DECISIONS-001.13
	public function testGivesUpAfterThreeConflictsAndStoresNothing(): void {
		$this->store->failures = 10;

		$thrown = null;
		try {
			$this->service->save($this->user('alice'), [self::item(1, 4)]);
		} catch (DbException $e) {
			$thrown = $e;
		}

		$this->assertInstanceOf(DbException::class, $thrown);
		$this->assertSame(3, $this->store->replaceCalls);
		$this->assertSame([], $this->service->lookup($this->user('alice'), [1]));
	}

	// spec: DECISIONS-001.13
	public function testDoesNotRepeatAnotherDatabaseError(): void {
		$this->store->failures = 1;
		$this->store->failureReason = DbException::REASON_DEADLOCK;

		$thrown = null;
		try {
			$this->service->save($this->user('alice'), [self::item(1, 4)]);
		} catch (DbException $e) {
			$thrown = $e;
		}

		$this->assertInstanceOf(DbException::class, $thrown);
		$this->assertSame(1, $this->store->replaceCalls);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedFileIds(): array {
		return [
			'not a list' => [['a' => 1]],
			'a text id' => [['1']],
			'a zero id' => [[0]],
			'over the limit' => [range(1, ListingService::ENTRY_LIMIT + 1)],
		];
	}

	// spec: DECISIONS-001.6
	#[DataProvider('malformedFileIds')]
	public function testRejectsMalformedFileIdsOnLookup(array $fileIds): void {
		$this->expectException(InvalidDecisionException::class);

		$this->service->lookup($this->user('alice'), $fileIds);
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedSaves(): array {
		return [
			'not a list' => [['a' => self::item(1)]],
			'a malformed item' => [[self::item(1), ['fileId' => 2]]],
			'a file id twice' => [[self::item(1, 2), self::item(1, 3)]],
			'over the limit' => [array_fill(0, ListingService::ENTRY_LIMIT + 1, self::item(1))],
		];
	}

	// spec: DECISIONS-001.5
	#[DataProvider('malformedSaves')]
	public function testWritesNothingWhenOneItemIsMalformed(array $items): void {
		$this->service->save($this->user('alice'), [self::item(1, 5)]);

		$thrown = null;
		try {
			$this->service->save($this->user('alice'), $items);
		} catch (InvalidDecisionException $e) {
			$thrown = $e;
		}

		$this->assertInstanceOf(InvalidDecisionException::class, $thrown);
		$this->assertSame(5, $this->service->lookup($this->user('alice'), [1])[0]->rating);
	}
}
