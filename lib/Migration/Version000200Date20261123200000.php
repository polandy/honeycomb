<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\VisualHash;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Creates every honeycomb table at once, the baseline before the first deployment (ADR 0055).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000200Date20261123200000 extends SimpleMigrationStep {
	private const int USER_ID_LENGTH = 64;
	private const int CONNECTION_ID_LENGTH = 64;
	/** A UUID. */
	private const int ASSET_ID_LENGTH = 36;
	/** Wide enough for every source, flag, colour label, kind, state and status. */
	private const int WORD_LENGTH = 16;
	private const int KEY_LENGTH = 64;
	private const int HASH_LENGTH = 16;
	private const int REASON_LENGTH = 32;
	/** `YYYY-MM-DD`. */
	private const int DAY_LENGTH = 10;
	private const int METRIC_LENGTH = 32;
	private const int CAMERA_MODEL_LENGTH = 128;
	/** Immich's ISO 8601 time as it sends it. */
	private const int TIME_LENGTH = 32;

	private const array NOT_NULL = ['notnull' => true];
	private const array NULL = ['notnull' => false];
	private const array USER_ID = ['notnull' => true, 'length' => self::USER_ID_LENGTH];
	private const array ETAG = ['notnull' => true, 'length' => VisualHash::MAX_ETAG_LENGTH];
	private const array WORD = ['notnull' => true, 'length' => self::WORD_LENGTH];
	private const array OPTIONAL_WORD = ['notnull' => false, 'length' => self::WORD_LENGTH];
	private const array KEEP_RAW = ['notnull' => false, 'default' => false];
	private const array ZERO = ['notnull' => true, 'default' => 0];

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		// A file's row has file_id; an Immich asset's row has connection_id and asset_id (ADR 0054).
		self::create($schema, 'honeycomb_decisions', [
			'source' => [Types::STRING, self::WORD],
			'file_id' => [Types::BIGINT, self::NULL],
			'connection_id' => [Types::STRING, ['notnull' => false, 'length' => self::CONNECTION_ID_LENGTH]],
			'asset_id' => [Types::STRING, ['notnull' => false, 'length' => self::ASSET_ID_LENGTH]],
			'user_id' => [Types::STRING, ['notnull' => false, 'length' => self::USER_ID_LENGTH]],
			'flag' => [Types::STRING, self::WORD],
			'keep_raw' => [Types::BOOLEAN, self::KEEP_RAW],
			'rating' => [Types::SMALLINT, self::NULL],
			'colour_label' => [Types::STRING, self::OPTIONAL_WORD],
			'updated_at' => [Types::BIGINT, self::NOT_NULL],
		], unique: [['file_id'], ['connection_id', 'asset_id']]);
		self::create($schema, 'honeycomb_positions', [
			'user_id' => [Types::STRING, self::USER_ID],
			'folder_set_key' => [Types::STRING, ['notnull' => true, 'length' => self::KEY_LENGTH]],
			'folder_set' => [Types::TEXT, self::NOT_NULL],
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'decided' => [Types::INTEGER, self::ZERO],
			'total' => [Types::INTEGER, self::ZERO],
			'updated_at' => [Types::BIGINT, self::NOT_NULL],
		], unique: [['user_id', 'folder_set_key']], index: [['user_id', 'updated_at']]);
		self::create($schema, 'honeycomb_tag_list', [
			'user_id' => [Types::STRING, self::USER_ID],
			'tag' => [Types::STRING, ['notnull' => true, 'length' => PictureTags::MAX_LENGTH]],
		], unique: [['user_id', 'tag']]);
		self::create($schema, 'honeycomb_hashes', [
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'etag' => [Types::STRING, self::ETAG],
			'hash' => [Types::STRING, ['notnull' => true, 'length' => self::HASH_LENGTH]],
		], unique: [['file_id']]);
		self::create($schema, 'honeycomb_series', [
			'user_id' => [Types::STRING, self::USER_ID],
			'status' => [Types::STRING, ['notnull' => true, 'length' => self::WORD_LENGTH, 'default' => SeriesStatus::Open->value]],
		], index: [['user_id']]);
		// A row without series_id is a kept-out photo; the empty-series sweep looks members up by series_id alone.
		self::create($schema, 'honeycomb_series_files', [
			'user_id' => [Types::STRING, self::USER_ID],
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'series_id' => [Types::BIGINT, self::NULL],
		], unique: [['user_id', 'file_id']], index: [['user_id', 'series_id'], ['series_id']]);
		self::create($schema, 'honeycomb_xmp_cache', [
			'user_id' => [Types::STRING, self::USER_ID],
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'kind' => [Types::STRING, self::WORD],
			'etag' => [Types::STRING, self::ETAG],
			'reader' => [Types::INTEGER, self::NOT_NULL],
			'state' => [Types::STRING, self::WORD],
			'reason' => [Types::STRING, ['notnull' => false, 'length' => self::REASON_LENGTH]],
			'rating' => [Types::SMALLINT, self::NULL],
			'flag' => [Types::STRING, self::OPTIONAL_WORD],
			'colour_label' => [Types::STRING, self::OPTIONAL_WORD],
			'keep_raw' => [Types::BOOLEAN, self::NULL],
			'tags' => [Types::TEXT, self::NULL],
		], unique: [['user_id', 'file_id']]);
		// Its leading user_id and day also serve every read of a period.
		self::create($schema, 'honeycomb_stats', [
			'user_id' => [Types::STRING, self::USER_ID],
			'day' => [Types::STRING, ['notnull' => true, 'length' => self::DAY_LENGTH]],
			'metric' => [Types::STRING, ['notnull' => true, 'length' => self::METRIC_LENGTH]],
			'value' => [Types::BIGINT, self::ZERO],
		], unique: [['user_id', 'day', 'metric']]);
		// The decision filter pages a connection's assets by capture time.
		self::create($schema, 'honeycomb_immich_assets', [
			'connection_id' => [Types::STRING, ['notnull' => true, 'length' => self::CONNECTION_ID_LENGTH]],
			'asset_id' => [Types::STRING, ['notnull' => true, 'length' => self::ASSET_ID_LENGTH]],
			'user_id' => [Types::STRING, self::USER_ID],
			'taken_at' => [Types::BIGINT, self::NOT_NULL],
			'camera_model' => [Types::STRING, ['notnull' => false, 'length' => self::CAMERA_MODEL_LENGTH]],
			'kind' => [Types::STRING, self::WORD],
			'asset_updated_at' => [Types::STRING, ['notnull' => true, 'length' => self::TIME_LENGTH]],
		], unique: [['connection_id', 'asset_id']], index: [['connection_id', 'taken_at']]);
		self::create($schema, 'honeycomb_quality', [
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'etag' => [Types::STRING, self::ETAG],
			'method' => [Types::SMALLINT, self::NOT_NULL],
			'sharpness' => [Types::FLOAT, self::NOT_NULL],
			'focus_tile' => [Types::SMALLINT, self::NOT_NULL],
		], unique: [['file_id']]);
		self::create($schema, 'honeycomb_folder_summary', [
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'etag' => [Types::STRING, self::ETAG],
			'photos' => [Types::INTEGER, self::NOT_NULL],
			'bytes' => [Types::BIGINT, self::NOT_NULL],
			'raw_bytes' => [Types::BIGINT, self::NOT_NULL],
			'bursts' => [Types::INTEGER, self::NOT_NULL],
			'oldest' => [Types::BIGINT, self::NULL],
			'newest' => [Types::BIGINT, self::NULL],
			'last_activity' => [Types::BIGINT, self::NULL],
			'scanned_at' => [Types::BIGINT, self::NOT_NULL],
		], unique: [['file_id']]);
		// user_id is null once the user who marked the folder done is deleted.
		self::create($schema, 'honeycomb_folder_done', [
			'file_id' => [Types::BIGINT, self::NOT_NULL],
			'user_id' => [Types::STRING, ['notnull' => false, 'length' => self::USER_ID_LENGTH]],
			'done_at' => [Types::BIGINT, self::NOT_NULL],
			'photos' => [Types::INTEGER, self::NOT_NULL],
		], unique: [['file_id']]);
		return $schema;
	}

	/**
	 * Creates the table with an autoincrement `id` key; each index is named after its table and columns.
	 * @param array<string, array{string, array<string, mixed>}> $columns name => [type, options]
	 * @param list<list<string>> $unique
	 * @param list<list<string>> $index
	 */
	private static function create(ISchemaWrapper $schema, string $name, array $columns, array $unique = [], array $index = []): void {
		$table = $schema->createTable($name);
		$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
		foreach ($columns as $column => [$type, $options]) {
			$table->addColumn($column, $type, $options);
		}
		$table->setPrimaryKey(['id']);
		foreach ($unique as $keys) {
			$table->addUniqueIndex($keys, $name . '_' . implode('_', $keys));
		}
		foreach ($index as $keys) {
			$table->addIndex($keys, $name . '_' . implode('_', $keys));
		}
	}
}
