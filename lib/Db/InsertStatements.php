<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCP\IDBConnection;

/** Builds one multi-row `INSERT` per chunk of rows instead of one per row, so a bulk save is short. */
final readonly class InsertStatements {
	/** Keeps a statement's parameters within every database's limit (SQLite: 32,766). */
	private const int ROWS_PER_STATEMENT = 1_000;

	/**
	 * @param string $table without the prefix
	 * @param non-empty-array<string, mixed> $columns each column's `IQueryBuilder::PARAM_*` type
	 */
	public function __construct(
		private string $table,
		private array $columns,
	) {
	}

	/**
	 * The statements inserting `$rows`; Oracle before 23ai lacks multi-row `VALUES`, so it gets one per row.
	 * @param list<array<string, scalar|null>> $rows each row's value of every column
	 * @param string $databaseProvider `IDBConnection::getDatabaseProvider()`
	 * @return list<InsertStatement>
	 * @throws \InvalidArgumentException for a row without one of the columns
	 */
	public function of(array $rows, string $databaseProvider): array {
		$rowsPerStatement = $databaseProvider === IDBConnection::PLATFORM_ORACLE ? 1 : self::ROWS_PER_STATEMENT;
		$names = array_keys($this->columns);
		$placeholders = '(' . implode(', ', array_fill(0, count($names), '?')) . ')';
		$prefix = 'INSERT INTO `*PREFIX*' . $this->table . '` (`' . implode('`, `', $names) . '`) VALUES ';
		$statements = [];
		foreach (array_chunk($rows, $rowsPerStatement) as $chunk) {
			$params = [];
			foreach ($chunk as $row) {
				foreach ($names as $name) {
					if (!array_key_exists($name, $row)) {
						throw new \InvalidArgumentException("A row for {$this->table} lacks the column $name.");
					}
					$params[] = $row[$name];
				}
			}
			$statements[] = new InsertStatement(
				$prefix . implode(', ', array_fill(0, count($chunk), $placeholders)),
				$params,
				array_merge(...array_fill(0, count($chunk), array_values($this->columns))),
			);
		}
		return $statements;
	}
}
