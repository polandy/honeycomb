<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\Server;

/**
 * A transaction that reads before it writes fails at once on SQLite with "database is locked" when
 * another save commits in between; this probes whether its first statement took the write lock.
 */
trait ProbesWriteLock {
	/** Whether a second connection found the write lock taken when the transaction asked for its second statement or committed. */
	private ?bool $lockedAfterFirstStatement = null;
	/** The steps of the probed transaction so far, null before it begins. */
	private ?int $transactionSteps = null;

	/** The test's connection, probing the lock at the second step of the first transaction it begins. */
	private function probedConnection(): IDBConnection {
		$step = function (): void {
			if ($this->transactionSteps !== null && ++$this->transactionSteps === 2 && $this->lockedAfterFirstStatement === null) {
				$this->lockedAfterFirstStatement = $this->writeLockTaken();
			}
		};
		$db = $this->createStub(IDBConnection::class);
		$db->method('beginTransaction')->willReturnCallback(function (): void {
			$this->transactionSteps = 0;
			$this->db->beginTransaction();
		});
		$db->method('commit')->willReturnCallback(function () use ($step): void {
			$step();
			$this->db->commit();
		});
		$db->method('rollBack')->willReturnCallback(fn () => $this->db->rollBack());
		$db->method('getDatabaseProvider')->willReturnCallback(fn (): string => $this->db->getDatabaseProvider());
		$db->method('getQueryBuilder')->willReturnCallback(function () use ($step): IQueryBuilder {
			$step();
			return $this->db->getQueryBuilder();
		});
		$db->method('executeStatement')->willReturnCallback(function (string $sql, array $params = [], array $types = []) use ($step): int {
			$step();
			return $this->db->executeStatement($sql, $params, $types);
		});
		return $db;
	}

	/** Whether a second connection to the database file cannot start a write at once. */
	private function writeLockTaken(): bool {
		$config = Server::get(IConfig::class);
		$file = $config->getSystemValueString('datadirectory') . '/' . $config->getSystemValueString('dbname', 'owncloud') . '.db';
		$other = new \PDO('sqlite:' . $file, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_TIMEOUT => 0]);
		try {
			$other->exec('BEGIN IMMEDIATE');
		} catch (\PDOException $busy) {
			return str_contains($busy->getMessage(), 'database is locked');
		}
		$other->exec('ROLLBACK');
		return false;
	}
}
