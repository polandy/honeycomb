<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\SeriesWrite;
use OCP\IDBConnection;

/**
 * A series write takes SQLite's write lock with its first statement (ProbesWriteLock).
 * @psalm-suppress PossiblyUndefinedArrayOffset The test destructures the id a write returns, one per series item.
 */
final class SeriesWriteLockTest extends DbTestCase {
	use ProbesWriteLock;

	// spec: SERIES-005.27
	public function testTakesTheWriteLockWithItsFirstStatementWhenReopeningAStoredSeries(): void {
		$this->assertSame(IDBConnection::PLATFORM_SQLITE, $this->db->getDatabaseProvider());
		[$id] = (new SeriesMapper($this->db))->write('alice', SeriesWrite::fromRequest([['id' => null, 'status' => 'done', 'fileIds' => [7, 8]]], [], []));

		$ids = (new SeriesMapper($this->probedConnection()))->write('alice', SeriesWrite::fromRequest([['id' => $id, 'status' => 'open', 'fileIds' => [7, 8]]], [], []));

		$this->assertTrue($this->lockedAfterFirstStatement);
		$this->assertSame([$id], $ids);
		$this->assertSame(SeriesStatus::Open, (new SeriesMapper($this->db))->find('alice', [7, 8])->series[0]->status);
	}
}
