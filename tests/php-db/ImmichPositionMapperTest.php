<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\ImmichPositionMapper;
use OCA\Honeycomb\Db\PositionMapper;
use OCA\Honeycomb\Domain\FolderSet;
use OCA\Honeycomb\Domain\ResumePosition;
use OCA\Honeycomb\Immich\ImmichPosition;

/** The connections' positions in the positions table beside the folder sets', against a real database (ADR 0044). */
final class ImmichPositionMapperTest extends DbTestCase {
	private const string ASSET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

	private ImmichPositionMapper $immich;
	private PositionMapper $folders;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->immich = new ImmichPositionMapper($this->db);
		$this->folders = new PositionMapper($this->db);
	}

	// spec: IMMICH-003.23
	public function testOnePositionPerConnectionApartFromTheFolderSets(): void {
		$folder = new ResumePosition(new FolderSet(['/Trip'], false), 12, 3, 10, 30);
		$this->folders->save('alice', $folder);
		$this->immich->save('alice', self::position('alice-phone', 1, 10));
		$this->immich->save('alice', self::position('alice-camera', 2, 20));
		$this->immich->save('alice', self::position('alice-phone', 3, 20));
		$this->immich->save('bob', self::position('bob-phone', 4, 40));

		$this->assertEquals([self::position('alice-phone', 3, 20), self::position('alice-camera', 2, 20)], $this->immich->all('alice'));
		$this->assertEquals([$folder], $this->folders->all('alice'));
	}

	// spec: IMMICH-003.18
	public function testKeepOnlyRemovesThePositionsOfConnectionsNotKeptForTheirUser(): void {
		$folder = new ResumePosition(new FolderSet(['/Trip'], false), 12, 3, 10, 30);
		$this->folders->save('alice', $folder);
		$this->immich->save('alice', self::position('alice-phone', 1, 10));
		$this->immich->save('alice', self::position('handed-over', 2, 10));
		$this->immich->save('bob', self::position('bob-phone', 3, 10));

		$this->assertSame(2, $this->immich->keepOnly([['alice-phone', 'alice'], ['handed-over', 'bob']]));

		$this->assertEquals([self::position('alice-phone', 1, 10)], $this->immich->all('alice'));
		$this->assertSame([], $this->immich->all('bob'));
		$this->assertEquals([$folder], $this->folders->all('alice'));
	}

	// spec: IMMICH-003.9
	public function testDeletingTheUserRemovesTheirConnectionsPositions(): void {
		$this->immich->save('alice', self::position('alice-phone', 1, 10));

		$this->folders->forgetUser('alice');

		$this->assertSame([], $this->immich->all('alice'));
	}

	private static function position(string $connectionId, int $decided, int $updatedAt): ImmichPosition {
		return new ImmichPosition($connectionId, self::ASSET, 1_795_000_000, $decided, 10, $updatedAt);
	}
}
