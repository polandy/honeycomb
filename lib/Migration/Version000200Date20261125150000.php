<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Drops the folder summaries with photos that a release before the previews wrote, so the next scan writes them with
 * their previews (FOLDERS-005.19); a summary stays fresh while its folder's etag holds, so nothing else rewrites them.
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000200Date20261125150000 extends SimpleMigrationStep {
	public function __construct(
		private readonly IDBConnection $db,
	) {
	}

	#[\Override]
	public function postSchemaChange(IOutput $output, \Closure $schemaClosure, array $options): void {
		$query = $this->db->getQueryBuilder();
		$dropped = $query->delete('honeycomb_folder_summary')
			->where($query->expr()->isNull('previews'))
			->andWhere($query->expr()->gt('photos', $query->createNamedParameter(0, IQueryBuilder::PARAM_INT)))
			->executeStatement();
		$output->info("Dropped $dropped folder summaries without previews; the next scan rewrites them.");
	}
}
