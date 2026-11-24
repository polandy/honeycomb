<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use Doctrine\DBAL\Schema\Column;
use Doctrine\DBAL\Schema\Index;
use Doctrine\DBAL\Types\Type;
use OCP\DB\Types;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\Server;
use PHPUnit\Framework\TestCase;

/** @psalm-suppress UndefinedClass, MixedAssignment, MixedArgument, MixedMethodCall Doctrine's schema is not in the stubs. */
final class SchemaTest extends TestCase {
	private const string FIXTURE = __DIR__ . '/../fixtures/schema/honeycomb.json';
	private const string PRIMARY = 'primary';

	public function testTheMigrationsCreateTheSchemaOfTheFixture(): void {
		$expected = json_decode($this->readFixture(), true, 512, JSON_THROW_ON_ERROR);

		$this->assertSame(json_encode($expected, JSON_PRETTY_PRINT), json_encode($this->snapshot(), JSON_PRETTY_PRINT));
	}

	public function testEveryIndexIsNamedAfterItsTableAndColumns(): void {
		foreach ($this->snapshot() as $table => ['indexes' => $indexes]) {
			foreach ($indexes as $name => $index) {
				if ($name !== self::PRIMARY) {
					$this->assertSame($table . '_' . implode('_', $this->columnsOf($index)), $name);
				}
			}
		}
	}

	/** @return array<string, array{columns: array<string, string>, indexes: array<string, string>}> each app table, columns and indexes as one line each */
	private function snapshot(): array {
		$prefix = Server::get(IConfig::class)->getSystemValueString('dbtableprefix', 'oc_');
		/** @var array<string, array{columns: array<string, string>, indexes: array<string, string>}> $snapshot */
		$snapshot = [];
		foreach (Server::get(IDBConnection::class)->createSchema()->getTables() as $table) {
			if (preg_match('/(?:^|\.)' . preg_quote($prefix, '/') . '(honeycomb_\w+)$/', $table->getName(), $match) !== 1) {
				continue;
			}
			/** @var array<string, string> $columns */
			$columns = [];
			foreach ($table->getColumns() as $column) {
				$columns[(string)$column->getName()] = $this->describeColumn($column);
			}
			/** @var array<string, string> $indexes */
			$indexes = [];
			foreach ($table->getIndexes() as $index) {
				$indexes[$index->isPrimary() ? self::PRIMARY : (string)$index->getName()] = $this->describeIndex($index);
			}
			ksort($columns);
			ksort($indexes);
			$snapshot[$match[1]] = ['columns' => $columns, 'indexes' => $indexes];
		}
		ksort($snapshot);
		return $snapshot;
	}

	/** @psalm-suppress UndefinedClass Doctrine's column is not in the stubs. */
	private function describeColumn(Column $column): string {
		$type = (string)Type::lookupName($column->getType());
		// SQLite keeps every autoincrement key as INTEGER.
		if ($column->getAutoincrement() && $type === Types::INTEGER && Server::get(IDBConnection::class)->getDatabaseProvider() === IDBConnection::PLATFORM_SQLITE) {
			$type = Types::BIGINT;
		}
		$parts = [$type === Types::STRING ? $type . '(' . (string)$column->getLength() . ')' : $type, $column->getNotnull() ? 'notnull' : 'null'];
		$default = $column->getDefault();
		if ($default !== null) {
			$parts[] = 'default ' . ($type === Types::BOOLEAN ? (filter_var($default, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false') : (string)$default);
		}
		if ($column->getAutoincrement()) {
			$parts[] = 'autoincrement';
		}
		return implode(' ', $parts);
	}

	/** @psalm-suppress UndefinedClass Doctrine's index is not in the stubs. */
	private function describeIndex(Index $index): string {
		return ($index->isPrimary() ? self::PRIMARY : ($index->isUnique() ? 'unique' : 'index')) . '(' . implode(', ', $index->getColumns()) . ')';
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
