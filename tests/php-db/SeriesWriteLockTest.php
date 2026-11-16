<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\SeriesWrite;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\Server;

/**
 * A series write takes SQLite's write lock with its first statement: a transaction that reads first
 * fails at once with "database is locked" when another save commits before its first write.
 */
final class SeriesWriteLockTest extends DbTestCase {
	/** Whether a second connection found the write lock taken right after the write's first statement. */
	private ?bool $lockedAfterFirstStatement = null;

	// spec: SERIES-005.27
	public function testTakesTheWriteLockWithItsFirstStatementWhenReopeningAStoredSeries(): void {
		$this->assertSame(IDBConnection::PLATFORM_SQLITE, $this->db->getDatabaseProvider());
		[$id] = (new SeriesMapper($this->db))->write('alice', SeriesWrite::fromRequest([['id' => null, 'status' => 'done', 'fileIds' => [7, 8]]], [], []));

		$ids = (new SeriesMapper($this->probedConnection()))->write('alice', SeriesWrite::fromRequest([['id' => $id, 'status' => 'open', 'fileIds' => [7, 8]]], [], []));

		$this->assertTrue($this->lockedAfterFirstStatement);
		$this->assertSame([$id], $ids);
		$this->assertSame(SeriesStatus::Open, (new SeriesMapper($this->db))->find('alice', [7, 8])->series[0]->status);
	}

	/** The test's connection, probing the lock when the write asks for its second statement. */
	private function probedConnection(): IDBConnection {
		$statements = 0;
		$probe = function () use (&$statements): void {
			if (++$statements === 2) {
				$this->lockedAfterFirstStatement = $this->writeLockTaken();
			}
		};
		$db = $this->createStub(IDBConnection::class);
		$db->method('beginTransaction')->willReturnCallback(fn () => $this->db->beginTransaction());
		$db->method('commit')->willReturnCallback(fn () => $this->db->commit());
		$db->method('rollBack')->willReturnCallback(fn () => $this->db->rollBack());
		$db->method('getDatabaseProvider')->willReturnCallback(fn () => $this->db->getDatabaseProvider());
		$db->method('getQueryBuilder')->willReturnCallback(function () use ($probe) {
			$probe();
			return $this->db->getQueryBuilder();
		});
		$db->method('executeStatement')->willReturnCallback(function (string $sql, array $params = [], array $types = []) use ($probe): int {
			$probe();
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
