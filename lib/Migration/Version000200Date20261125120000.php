<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Domain\VisualHash;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Adds to a schema from the first baseline what the baseline gained before 0.2.0, so a test server that ran it needs no
 * reinstall; on any other schema it changes nothing (ADR 0055).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000200Date20261125120000 extends SimpleMigrationStep {
	private const int USER_ID_LENGTH = 64;
	private const int ASSET_ID_LENGTH = 255;
	/** Three `fileId:mtime` pairs: 3 times 21 characters and two commas. */
	private const int PREVIEWS_LENGTH = 100;
	/** dHash, the first visual hash method (ADR 0024). */
	private const int FIRST_METHOD = 1;
	/** The tables whose `asset_id` the baseline widened from a UUID's 36 characters. */
	private const array ASSET_ID_TABLES = ['honeycomb_decisions', 'honeycomb_immich_assets', 'honeycomb_positions'];

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		$changes = [
			self::addColumn($schema, 'honeycomb_decisions', 'updated_by', Types::STRING, ['notnull' => false, 'length' => self::USER_ID_LENGTH]),
			self::addColumn($schema, 'honeycomb_decisions', 'sidecar_etag', Types::STRING, ['notnull' => false, 'length' => VisualHash::MAX_ETAG_LENGTH]),
			self::addIndex($schema, 'honeycomb_decisions', ['user_id']),
			self::addIndex($schema, 'honeycomb_decisions', ['source', 'connection_id']),
			self::addColumn($schema, 'honeycomb_hashes', 'method', Types::SMALLINT, ['notnull' => true, 'default' => self::FIRST_METHOD]),
			self::addIndex($schema, 'honeycomb_immich_assets', ['user_id']),
			self::addColumn($schema, 'honeycomb_positions', 'asset_id', Types::STRING, ['notnull' => false, 'length' => self::ASSET_ID_LENGTH]),
			self::addColumn($schema, 'honeycomb_positions', 'taken_at', Types::BIGINT, ['notnull' => false]),
			self::allowNull($schema, 'honeycomb_positions', 'file_id'),
			self::addColumn($schema, 'honeycomb_folder_summary', 'previews', Types::STRING, ['notnull' => false, 'length' => self::PREVIEWS_LENGTH]),
			...array_map(static fn (string $table): bool => self::widenAssetId($schema, $table), self::ASSET_ID_TABLES),
		];
		return in_array(true, $changes, true) ? $schema : null;
	}

	/**
	 * Adds the column unless the table has it; answers whether it did.
	 * @param non-empty-string $column
	 * @param Types::* $type
	 * @param array{default?: scalar, length?: int, notnull?: bool} $options
	 */
	private static function addColumn(ISchemaWrapper $schema, string $table, string $column, string $type, array $options): bool {
		if ($schema->getTable($table)->hasColumn($column)) {
			return false;
		}
		$schema->getTable($table)->addColumn($column, $type, $options);
		return true;
	}

	/**
	 * Adds the index named after its table and columns unless the table has it; answers whether it did.
	 * @param list<non-empty-string> $columns
	 */
	private static function addIndex(ISchemaWrapper $schema, string $table, array $columns): bool {
		$name = $table . '_' . implode('_', $columns);
		if ($schema->getTable($table)->hasIndex($name)) {
			return false;
		}
		$schema->getTable($table)->addIndex($columns, $name);
		return true;
	}

	/**
	 * Lets the column hold null unless it does; every supported database makes that change in place.
	 * @param non-empty-string $column
	 */
	private static function allowNull(ISchemaWrapper $schema, string $table, string $column): bool {
		$definition = $schema->getTable($table)->getColumn($column);
		if (!$definition->getNotnull()) {
			return false;
		}
		$definition->setNotnull(false);
		return true;
	}

	/** Widens `asset_id` to the baseline's length unless it is that wide; a longer string keeps every value. */
	private static function widenAssetId(ISchemaWrapper $schema, string $table): bool {
		$definition = $schema->getTable($table)->getColumn('asset_id');
		if ($definition->getLength() === self::ASSET_ID_LENGTH) {
			return false;
		}
		$definition->setLength(self::ASSET_ID_LENGTH);
		return true;
	}
}
