<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Service\VisualHash;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Keeps one visual hash and one quality value per file, for every user, and drops the hashes per user (ADR 0046).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000007Date20261120120000 extends SimpleMigrationStep {
	private const string HASHES = 'honeycomb_hashes';
	private const string QUALITY = 'honeycomb_quality';
	private const string USER_ID = 'user_id';

	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** Drops the hashes per user before their unique key changes; the browser computes them again (ADR 0046). */
	#[\Override]
	public function preSchemaChange(IOutput $output, \Closure $schemaClosure, array $options): void {
		$schema = $schemaClosure();
		if ($schema->hasTable(self::HASHES) && $schema->getTable(self::HASHES)->hasColumn(self::USER_ID)) {
			$this->db->getQueryBuilder()->delete(self::HASHES)->executeStatement();
		}
	}

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		$hashes = $schema->getTable(self::HASHES);
		if ($hashes->hasColumn(self::USER_ID)) {
			$hashes->dropIndex('honeycomb_hashes_user_file');
			$hashes->dropColumn(self::USER_ID);
			$hashes->addUniqueIndex(['file_id'], 'honeycomb_hashes_file');
		}
		if (!$schema->hasTable(self::QUALITY)) {
			$table = $schema->createTable(self::QUALITY);
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('etag', Types::STRING, ['notnull' => true, 'length' => VisualHash::MAX_ETAG_LENGTH]);
			$table->addColumn('method', Types::SMALLINT, ['notnull' => true]);
			$table->addColumn('sharpness', Types::FLOAT, ['notnull' => true]);
			$table->addColumn('focus_tile', Types::SMALLINT, ['notnull' => true]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['file_id'], 'honeycomb_quality_file');
		}
		return $schema;
	}
}
