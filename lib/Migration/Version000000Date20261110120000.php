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
 * Creates the decision and resume position tables (ADR 0012).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000000Date20261110120000 extends SimpleMigrationStep {
	/** Nextcloud's user id column width. */
	private const int USER_ID_LENGTH = 64;
	/** The longest colour label and flag names, `magenta` and `unflagged`. */
	private const int NAME_LENGTH = 16;
	/** A SHA-256 in hex. */
	private const int KEY_LENGTH = 64;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('honeycomb_decisions')) {
			$table = $schema->createTable('honeycomb_decisions');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('rating', Types::SMALLINT, ['notnull' => true, 'default' => 0]);
			$table->addColumn('colour_label', Types::STRING, ['notnull' => false, 'length' => self::NAME_LENGTH]);
			$table->addColumn('flag', Types::STRING, ['notnull' => true, 'length' => self::NAME_LENGTH]);
			$table->addColumn('keep_raw', Types::BOOLEAN, ['notnull' => false, 'default' => false]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id', 'file_id'], 'honeycomb_decisions_user_file');
		}
		if (!$schema->hasTable('honeycomb_positions')) {
			$table = $schema->createTable('honeycomb_positions');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('folder_set_key', Types::STRING, ['notnull' => true, 'length' => self::KEY_LENGTH]);
			$table->addColumn('folder_set', Types::TEXT, ['notnull' => true]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('decided', Types::INTEGER, ['notnull' => true, 'default' => 0]);
			$table->addColumn('total', Types::INTEGER, ['notnull' => true, 'default' => 0]);
			$table->addColumn('updated_at', Types::BIGINT, ['notnull' => true]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id', 'folder_set_key'], 'honeycomb_positions_user_set');
			$table->addIndex(['user_id', 'updated_at'], 'honeycomb_positions_user_time');
		}
		return $schema;
	}
}
