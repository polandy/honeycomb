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
 * Keeps the decisions of files and Immich assets in one table and drops `honeycomb_flags` with its rows (ADR 0054).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000011Date20261123120000 extends SimpleMigrationStep {
	private const string TABLE = 'honeycomb_decisions';
	private const string FLAGS = 'honeycomb_flags';
	private const int CONNECTION_ID_LENGTH = 64;
	/** A UUID. */
	private const int ASSET_ID_LENGTH = 36;
	private const int USER_ID_LENGTH = 64;
	/** Wide enough for every source, flag and colour label. */
	private const int WORD_LENGTH = 16;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if ($schema->hasTable(self::TABLE)) {
			return null;
		}
		$table = $schema->createTable(self::TABLE);
		$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
		$table->addColumn('source', Types::STRING, ['notnull' => true, 'length' => self::WORD_LENGTH]);
		$table->addColumn('file_id', Types::BIGINT, ['notnull' => false]);
		$table->addColumn('connection_id', Types::STRING, ['notnull' => false, 'length' => self::CONNECTION_ID_LENGTH]);
		$table->addColumn('asset_id', Types::STRING, ['notnull' => false, 'length' => self::ASSET_ID_LENGTH]);
		$table->addColumn('user_id', Types::STRING, ['notnull' => false, 'length' => self::USER_ID_LENGTH]);
		$table->addColumn('flag', Types::STRING, ['notnull' => true, 'length' => self::WORD_LENGTH]);
		$table->addColumn('keep_raw', Types::BOOLEAN, ['notnull' => false, 'default' => false]);
		$table->addColumn('rating', Types::SMALLINT, ['notnull' => false]);
		$table->addColumn('colour_label', Types::STRING, ['notnull' => false, 'length' => self::WORD_LENGTH]);
		$table->addColumn('updated_at', Types::BIGINT, ['notnull' => true]);
		$table->setPrimaryKey(['id']);
		$table->addUniqueIndex(['file_id'], 'honeycomb_decisions_file_id');
		$table->addUniqueIndex(['connection_id', 'asset_id'], 'honeycomb_decisions_asset');
		if ($schema->hasTable(self::FLAGS)) {
			$schema->dropTable(self::FLAGS);
		}
		return $schema;
	}
}
