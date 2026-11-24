<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use PHPUnit\Framework\TestCase;

final class SchemaTest extends TestCase {
	private const string FIXTURE = __DIR__ . '/../fixtures/schema/honeycomb.json';

	public function testTheMigrationsCreateTheSchemaOfTheFixture(): void {
		$expected = json_decode($this->readFixture(), true, 512, JSON_THROW_ON_ERROR);

		$this->assertSame(json_encode($expected, JSON_PRETTY_PRINT), json_encode(SchemaSnapshot::live(), JSON_PRETTY_PRINT));
	}

	public function testEveryIndexIsNamedAfterItsTableAndColumns(): void {
		foreach (SchemaSnapshot::live() as $table => ['indexes' => $indexes]) {
			foreach ($indexes as $name => $index) {
				if ($name !== SchemaSnapshot::PRIMARY) {
					$this->assertSame($table . '_' . implode('_', $this->columnsOf($index)), $name);
				}
			}
		}
	}

	/** @psalm-suppress ForbiddenCode Reads the schema fixture, not a user file. */
	private function readFixture(): string {
		return (string)file_get_contents(self::FIXTURE);
	}

	/** @return list<string> */
	private function columnsOf(string $description): array {
		return explode(', ', (string)preg_replace('/^\w+\((.*)\)$/', '$1', $description));
	}
}
