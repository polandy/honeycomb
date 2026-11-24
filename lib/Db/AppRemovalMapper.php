<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\BackgroundJob\RenderPhotoTiers;
use OCA\Honeycomb\BackgroundJob\SweepVanishedRows;
use OCA\Honeycomb\Service\AppRemoval;
use OCP\BackgroundJob\IJobList;
use OCP\IAppConfig;
use OCP\IDBConnection;

/** Drops the app's tables, also those of older releases, then deletes its rows of the shared tables; the app config goes last, so a failed run can be repeated. */
final class AppRemovalMapper implements AppRemoval {
	private const string APP = 'honeycomb';
	private const array LEGACY_TABLES = ['honeycomb_flags', 'honeycomb_file_tags'];
	private const array JOBS = [SweepVanishedRows::class, RenderPhotoTiers::class];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
		private IAppConfig $config,
		private IJobList $jobs,
	) {
	}

	#[\Override]
	public function tables(): array {
		return array_values(array_filter([...AppDataMapper::TABLES, ...self::LEGACY_TABLES], $this->db->tableExists(...)));
	}

	#[\Override]
	public function remove(): array {
		$query = $this->db->getQueryBuilder();
		$query->delete('preferences')->where($query->expr()->eq('appid', $query->createNamedParameter(self::APP)))->executeStatement();
		foreach (self::JOBS as $job) {
			$this->jobs->remove($job);
		}
		$dropped = $this->tables();
		foreach ($dropped as $table) {
			$this->db->dropTable($table);
		}
		$query = $this->db->getQueryBuilder();
		$query->delete('migrations')->where($query->expr()->eq('app', $query->createNamedParameter(self::APP)))->executeStatement();
		$this->config->deleteApp(self::APP);
		return $dropped;
	}
}
