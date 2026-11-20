<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\PhpLocalFiles;
use PHPUnit\Framework\TestCase;

final class PhpLocalFilesTest extends TestCase {
	private const string DIRECTORY = __DIR__ . '/../../fixtures/immich/local/';

	public function testItReadsAFileAsItIs(): void {
		$this->assertSame("  a key in a file\n", (new PhpLocalFiles())->read(self::DIRECTORY . 'key.txt'));
	}

	public function testAMissingFileOrADirectoryReadsAsNothing(): void {
		$this->assertNull((new PhpLocalFiles())->read(self::DIRECTORY . 'missing.txt'));
		$this->assertNull((new PhpLocalFiles())->read(self::DIRECTORY));
	}
}
