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
	private const array TABLES = ['honeycomb_flags', 'honeycomb_tag_list', 'honeycomb_series', 'honeycomb_series_files', 'honeycomb_xmp_cache', 'honeycomb_hashes', 'honeycomb_positions', 'honeycomb_stats', 'honeycomb_immich_assets', 'honeycomb_quality', 'honeycomb_folder_summary', 'honeycomb_folder_done'];

	protected IDBConnection $db;

	#[\Override]
	protected function setUp(): void {
		$this->db = Server::get(IDBConnection::class);
		foreach (self::TABLES as $table) {
			$this->db->getQueryBuilder()->delete($table)->executeStatement();
		}
	}
}
