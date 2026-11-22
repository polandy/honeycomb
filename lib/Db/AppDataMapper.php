<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\AppData;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Counts and empties the app's tables and its preferences rows, in one transaction. */
final class AppDataMapper implements AppData {
	use TTransactional;

	private const string APP = 'honeycomb';
	private const string PREFERENCES = 'preferences';
	private const array TABLES = ['honeycomb_flags', 'honeycomb_tag_list', 'honeycomb_series', 'honeycomb_series_files', 'honeycomb_xmp_cache', 'honeycomb_hashes', 'honeycomb_positions', 'honeycomb_stats', 'honeycomb_immich_assets', 'honeycomb_quality', 'honeycomb_folder_summary', 'honeycomb_folder_done'];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	#[\Override]
	public function count(): array {
		$counts = [];
		foreach ([...self::TABLES, self::PREFERENCES] as $table) {
			$query = $this->db->getQueryBuilder();
			$query->select($query->func()->count('*'))->from($table);
			$this->ownRows($query, $table);
			$counts[$table] = (int)$query->executeQuery()->fetchOne();
		}
		return $counts;
	}

	#[\Override]
	public function empty(): array {
		return $this->atomic(function (): array {
			$removed = [];
			foreach ([...self::TABLES, self::PREFERENCES] as $table) {
				$query = $this->db->getQueryBuilder();
				$query->delete($table);
				$this->ownRows($query, $table);
				$removed[$table] = $query->executeStatement();
			}
			return $removed;
		}, $this->db);
	}

	/** The preferences table is shared with every app, so only honeycomb's rows count. */
	private function ownRows(IQueryBuilder $query, string $table): void {
		if ($table === self::PREFERENCES) {
			$query->where($query->expr()->eq('appid', $query->createNamedParameter(self::APP)));
		}
	}
}
