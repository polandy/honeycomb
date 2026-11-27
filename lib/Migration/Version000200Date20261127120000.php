<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCP\DB\ISchemaWrapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\DB\Types;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Adds the folder summaries' shot days and drops the summaries with photos written without them, so the next scan writes
 * them (ADR 0062, FOLDERS-005.23); a summary stays fresh while its folder's etag holds, so nothing else rewrites them.
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000200Date20261127120000 extends SimpleMigrationStep {
	private const string TABLE = 'honeycomb_folder_summary';
	private const string COLUMN = 'shot_days';

	public function __construct(
		private readonly IDBConnection $db,
	) {
	}

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		$table = $schema->getTable(self::TABLE);
		if ($table->hasColumn(self::COLUMN)) {
			return null;
		}
		// Text, as a folder's days may pass the 4000 characters of a string (ADR 0055).
		$table->addColumn(self::COLUMN, Types::TEXT, ['notnull' => false]);
		return $schema;
	}

	#[\Override]
	public function postSchemaChange(IOutput $output, \Closure $schemaClosure, array $options): void {
		$query = $this->db->getQueryBuilder();
		$dropped = $query->delete(self::TABLE)
			->where($query->expr()->isNull(self::COLUMN))
			->andWhere($query->expr()->gt('photos', $query->createNamedParameter(0, IQueryBuilder::PARAM_INT)))
			->executeStatement();
		$output->info("Dropped $dropped folder summaries without shot days; the next scan rewrites them.");
	}
}
