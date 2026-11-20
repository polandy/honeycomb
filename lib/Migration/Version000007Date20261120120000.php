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
 * Keeps the whole decision of each Immich asset per connection (ADR 0043).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000007Date20261120120000 extends SimpleMigrationStep {
	private const string TABLE = 'honeycomb_immich_assets';
	private const int CONNECTION_ID_LENGTH = 64;
	/** A UUID. */
	private const int ASSET_ID_LENGTH = 36;
	private const int USER_ID_LENGTH = 64;
	/** Wide enough for every colour label, flag and kind. */
	private const int WORD_LENGTH = 16;
	private const int CAMERA_MODEL_LENGTH = 128;
	/** An ISO 8601 time with milliseconds and offset. */
	private const int TIME_LENGTH = 32;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if ($schema->hasTable(self::TABLE)) {
			return null;
		}
		$table = $schema->createTable(self::TABLE);
		$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
		$table->addColumn('connection_id', Types::STRING, ['notnull' => true, 'length' => self::CONNECTION_ID_LENGTH]);
		$table->addColumn('asset_id', Types::STRING, ['notnull' => true, 'length' => self::ASSET_ID_LENGTH]);
		$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
		$table->addColumn('rating', Types::SMALLINT, ['notnull' => true, 'default' => 0]);
		$table->addColumn('colour_label', Types::STRING, ['notnull' => false, 'length' => self::WORD_LENGTH]);
		$table->addColumn('flag', Types::STRING, ['notnull' => true, 'length' => self::WORD_LENGTH]);
		$table->addColumn('keep_raw', Types::BOOLEAN, ['notnull' => false, 'default' => false]);
		$table->addColumn('taken_at', Types::BIGINT, ['notnull' => true]);
		$table->addColumn('camera_model', Types::STRING, ['notnull' => false, 'length' => self::CAMERA_MODEL_LENGTH]);
		$table->addColumn('kind', Types::STRING, ['notnull' => true, 'length' => self::WORD_LENGTH]);
		$table->addColumn('asset_updated_at', Types::STRING, ['notnull' => true, 'length' => self::TIME_LENGTH]);
		$table->addColumn('updated_at', Types::BIGINT, ['notnull' => true]);
		$table->setPrimaryKey(['id']);
		$table->addUniqueIndex(['connection_id', 'asset_id'], 'honeycomb_immich_asset');
		// The decision filter pages a connection's rows of one flag by capture time.
		$table->addIndex(['connection_id', 'flag', 'taken_at'], 'honeycomb_immich_flag');
		return $schema;
	}
}
