<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCP\IDBConnection;
use OCP\Server;
use PHPUnit\Framework\TestCase;

/** A test against the database of the Nextcloud it runs in, with the app's tables emptied before each test. */
abstract class DbTestCase extends TestCase {
	private const array TABLES = ['honeycomb_decisions', 'honeycomb_tag_list', 'honeycomb_series', 'honeycomb_series_files', 'honeycomb_xmp_cache', 'honeycomb_hashes', 'honeycomb_positions', 'honeycomb_stats', 'honeycomb_immich_assets', 'honeycomb_quality', 'honeycomb_folder_summary', 'honeycomb_folder_done'];

	protected IDBConnection $db;

	#[\Override]
	protected function setUp(): void {
		$this->db = Server::get(IDBConnection::class);
		foreach (self::TABLES as $table) {
			$this->db->getQueryBuilder()->delete($table)->executeStatement();
		}
	}

	/** The row ids of a table by file id, to see which rows a save kept. @return array<int, int> */
	protected function rowIds(string $table): array {
		$query = $this->db->getQueryBuilder();
		$result = $query->select('id', 'file_id')->from($table)->executeQuery();
		$ids = [];
		while (($row = $result->fetch()) !== false) {
			$ids[(int)$row['file_id']] = (int)$row['id'];
		}
		$result->closeCursor();
		ksort($ids);
		return $ids;
	}
}
