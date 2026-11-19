<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCP\IDBConnection;

/**
 * The bulk inserts every mapper shares, and the removal of a user's rows.
 * @property IDBConnection $db
 */
trait UserRowQueries {
	/**
	 * Runs the statements inserting `$rows`.
	 * @param list<array<string, scalar|null>> $rows
	 */
	private function insertRows(InsertStatements $insert, array $rows): void {
		foreach ($insert->of($rows, $this->db->getDatabaseProvider()) as $statement) {
			$this->db->executeStatement($statement->sql, $statement->params, $statement->types);
		}
	}

	private function deleteUserRows(string $table, string $userId): void {
		$query = $this->db->getQueryBuilder();
		$query->delete($table)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->executeStatement();
	}
}
