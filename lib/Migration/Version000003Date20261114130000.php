<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Service\SeriesStatus;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Creates the series tables (ADR 0027).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000003Date20261114130000 extends SimpleMigrationStep {
	/** Nextcloud's user id column width. */
	private const int USER_ID_LENGTH = 64;
	/** Wide enough for every `SeriesStatus` value. */
	private const int STATUS_LENGTH = 16;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('honeycomb_series')) {
			$table = $schema->createTable('honeycomb_series');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('status', Types::STRING, ['notnull' => true, 'length' => self::STATUS_LENGTH, 'default' => SeriesStatus::Open->value]);
			$table->setPrimaryKey(['id']);
			$table->addIndex(['user_id'], 'honeycomb_series_user');
		}
		if (!$schema->hasTable('honeycomb_series_files')) {
			$table = $schema->createTable('honeycomb_series_files');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('series_id', Types::BIGINT, ['notnull' => false]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id', 'file_id'], 'honeycomb_sfiles_user_file');
			$table->addIndex(['user_id', 'series_id'], 'honeycomb_sfiles_user_series');
		}
		return $schema;
	}
}
