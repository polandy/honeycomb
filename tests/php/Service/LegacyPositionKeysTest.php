<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\LegacyPositionKeys;
use OCA\Honeycomb\Service\ResumePosition;
use PHPUnit\Framework\TestCase;

final class LegacyPositionKeysTest extends TestCase {
	/** The key of ADR 0012, before ADR 0034: every ticked path counts. */
	private static function legacyKey(FolderSet $set): string {
		return hash('sha256', json_encode([$set->paths, $set->subfolders], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	}

	/** @param list<string> $paths */
	private static function position(array $paths, bool $subfolders, int $fileId): ResumePosition {
		return new ResumePosition(new FolderSet($paths, $subfolders), $fileId, 0, 1, 0);
	}

	// spec: DECISIONS-002.15
	public function testRowsUnderTheCurrentKeyNeedNoWrite(): void {
		$trip = self::position(['/Trip', '/Trip/Day 2'], true, 1);
		$home = self::position(['/Home'], false, 2);

		$repair = LegacyPositionKeys::repair([[$trip->folderSet->key(), $trip], [$home->folderSet->key(), $home]]);

		$this->assertSame(['keep' => [$trip, $home], 'forget' => [], 'rekey' => []], $repair);
	}

	// spec: DECISIONS-002.15
	public function testARowUnderTheOlderKeyTakesTheCurrentKey(): void {
		$trip = self::position(['/Trip', '/Trip/Day 2'], true, 1);

		$repair = LegacyPositionKeys::repair([[self::legacyKey($trip->folderSet), $trip]]);

		$this->assertSame(['keep' => [$trip], 'forget' => [], 'rekey' => [[self::legacyKey($trip->folderSet), $trip->folderSet->key()]]], $repair);
	}

	// spec: DECISIONS-002.15
	public function testOfTwoRowsThatBecomeOneFolderSetTheNewerStays(): void {
		$newer = self::position(['/Trip', '/Trip/Day 2'], true, 1);
		$home = self::position(['/Home'], false, 2);
		$older = self::position(['/Trip'], true, 3);
		$oldest = self::position(['/Trip', '/Trip/Day 3'], true, 4);
		$rows = [[self::legacyKey($newer->folderSet), $newer], [$home->folderSet->key(), $home], [$older->folderSet->key(), $older], [self::legacyKey($oldest->folderSet), $oldest]];

		$repair = LegacyPositionKeys::repair($rows);

		$this->assertSame([$newer, $home], $repair['keep']);
		$this->assertSame([$older->folderSet->key(), self::legacyKey($oldest->folderSet)], $repair['forget']);
		$this->assertSame([[self::legacyKey($newer->folderSet), $newer->folderSet->key()]], $repair['rekey']);
	}

	public function testNoRowsNeedNoWrite(): void {
		$this->assertSame(['keep' => [], 'forget' => [], 'rekey' => []], LegacyPositionKeys::repair([]));
	}
}
