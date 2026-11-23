<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCP\DB\ISchemaWrapper;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Leaves only the facets in `honeycomb_immich_assets`, as the decisions live in `honeycomb_decisions` (ADR 0054).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000012Date20261123180000 extends SimpleMigrationStep {
	private const string TABLE = 'honeycomb_immich_assets';
	private const array DECISION_COLUMNS = ['rating', 'colour_label', 'flag', 'keep_raw', 'updated_at'];
	private const string FLAG_INDEX = 'honeycomb_immich_flag';
	private const string TAKEN_INDEX = 'honeycomb_immich_taken';

	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** Facets without their decision row would be orphans, so the rows go, as allowed before the first deployment. */
	#[\Override]
	public function preSchemaChange(IOutput $output, \Closure $schemaClosure, array $options): void {
		$schema = $schemaClosure();
		if ($schema->hasTable(self::TABLE) && $schema->getTable(self::TABLE)->hasColumn('flag')) {
			$this->db->getQueryBuilder()->delete(self::TABLE)->executeStatement();
		}
	}

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable(self::TABLE)) {
			return null;
		}
		$table = $schema->getTable(self::TABLE);
		if (!$table->hasColumn('flag')) {
			return null;
		}
		if ($table->hasIndex(self::FLAG_INDEX)) {
			$table->dropIndex(self::FLAG_INDEX);
		}
		foreach (self::DECISION_COLUMNS as $column) {
			$table->dropColumn($column);
		}
		// The decision filter pages a connection's assets by capture time.
		$table->addIndex(['connection_id', 'taken_at'], self::TAKEN_INDEX);
		return $schema;
	}
}
