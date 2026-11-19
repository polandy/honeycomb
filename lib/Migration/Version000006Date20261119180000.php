<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Keeps the statistics as daily counters per user, day and metric (ADR 0039).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000006Date20261119180000 extends SimpleMigrationStep {
	private const int USER_ID_LENGTH = 64;
	/** `YYYY-MM-DD`. */
	private const int DAY_LENGTH = 10;
	/** Wide enough for every `StatsMetric` key. */
	private const int METRIC_LENGTH = 32;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if ($schema->hasTable('honeycomb_stats')) {
			return null;
		}
		$table = $schema->createTable('honeycomb_stats');
		$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
		$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
		$table->addColumn('day', Types::STRING, ['notnull' => true, 'length' => self::DAY_LENGTH]);
		$table->addColumn('metric', Types::STRING, ['notnull' => true, 'length' => self::METRIC_LENGTH]);
		$table->addColumn('value', Types::BIGINT, ['notnull' => true, 'default' => 0]);
		$table->setPrimaryKey(['id']);
		// Its leading user_id and day also serve every read of a period.
		$table->addUniqueIndex(['user_id', 'day', 'metric'], 'honeycomb_stats_day');
		return $schema;
	}
}
