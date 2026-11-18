<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Db;

use OCA\Honeycomb\Db\SubtreeExactness;
use OCP\Files\Storage\IStorage;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SubtreeExactnessTest extends TestCase {
	/** @return array<string, array{int, bool, bool}> */
	public static function subtrees(): array {
		return [
			'scanned, plain storage' => [1024, false, false],
			'empty folder' => [0, false, false],
			'unknown size, as the file cache marks unscanned files' => [-1, false, true],
			'group folder with advanced permissions' => [1024, true, true],
			'both' => [-1, true, true],
		];
	}

	// spec: LISTING-003.20
	#[DataProvider('subtrees')]
	public function testSaysWhetherTheCountOfASubtreeMayMissFiles(int $size, bool $acl, bool $expected): void {
		$storage = $this->createMock(IStorage::class);
		$storage->method('instanceOfStorage')->willReturnCallback(static fn (string $class): bool => $acl && $class === SubtreeExactness::ACL_STORAGE);

		$this->assertSame($expected, SubtreeExactness::mayMissFiles($size, $storage));
	}

	// spec: LISTING-003.20
	public function testAMountNotScannedYetMayMissFiles(): void {
		$this->assertTrue(SubtreeExactness::unscannedMount(0));
		$this->assertTrue(SubtreeExactness::unscannedMount(-1));
		$this->assertFalse(SubtreeExactness::unscannedMount(7));
	}
}
