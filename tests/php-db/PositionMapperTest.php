<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\Position;
use OCA\Honeycomb\Db\PositionMapper;
use OCA\Honeycomb\Domain\FolderSet;
use OCA\Honeycomb\Domain\ResumePosition;

/** The resume positions, and the re-keying of rows stored under the older folder set key, against a real database. */
final class PositionMapperTest extends DbTestCase {
	private PositionMapper $positions;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->positions = new PositionMapper($this->db);
	}

	/** Stores a row the way the code before ADR 0034 did: under the hash of every ticked path. */
	private function storeLegacy(string $userId, ResumePosition $position): void {
		$row = Position::of($userId, $position);
		$row->setFolderSetKey(hash('sha256', json_encode([$position->folderSet->paths, $position->folderSet->subfolders], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)));
		$this->positions->insert($row);
	}

	private static function trip(int $fileId, int $updatedAt): ResumePosition {
		return new ResumePosition(new FolderSet(['/Trip', '/Trip/Day 2'], true), $fileId, 0, 1, $updatedAt);
	}

	// spec: DECISIONS-002.15
	public function testReKeysARowStoredUnderTheOlderKeyAndKeepsItOnce(): void {
		$this->storeLegacy('alice', self::trip(1, 10));

		$this->assertEquals([self::trip(1, 10)], $this->positions->all('alice'));
		$this->assertEquals([self::trip(1, 10)], $this->positions->all('alice'));

		$this->positions->save('alice', new ResumePosition(new FolderSet(['/Trip'], true), 2, 0, 1, 20));
		$this->assertEquals([2], array_map(static fn (ResumePosition $p): int => $p->fileId, $this->positions->all('alice')));
	}

	// spec: DECISIONS-002.15
	public function testOfTwoRowsThatBecomeOneSetTheNewerStaysAndOtherUsersAreLeftAlone(): void {
		$this->storeLegacy('alice', new ResumePosition(new FolderSet(['/Trip'], true), 1, 0, 1, 10));
		$this->storeLegacy('alice', self::trip(2, 20));
		$this->storeLegacy('bob', self::trip(3, 5));

		$this->assertEquals([self::trip(2, 20)], $this->positions->all('alice'));
		$this->assertEquals([self::trip(3, 5)], $this->positions->all('bob'));
	}
}
