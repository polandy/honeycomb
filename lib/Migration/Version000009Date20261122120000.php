<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Service\VisualHash;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Keeps one summary and one done status per folder, for every user (ADR 0049).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000009Date20261122120000 extends SimpleMigrationStep {
	private const string SUMMARY = 'honeycomb_folder_summary';
	private const string DONE = 'honeycomb_folder_done';
	/** The length of Nextcloud's user id column. */
	private const int USER_ID_LENGTH = 64;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable(self::SUMMARY)) {
			$table = $schema->createTable(self::SUMMARY);
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('etag', Types::STRING, ['notnull' => true, 'length' => VisualHash::MAX_ETAG_LENGTH]);
			$table->addColumn('photos', Types::INTEGER, ['notnull' => true]);
			$table->addColumn('bytes', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('raw_bytes', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('bursts', Types::INTEGER, ['notnull' => true]);
			$table->addColumn('oldest', Types::BIGINT, ['notnull' => false]);
			$table->addColumn('newest', Types::BIGINT, ['notnull' => false]);
			$table->addColumn('last_activity', Types::BIGINT, ['notnull' => false]);
			$table->addColumn('scanned_at', Types::BIGINT, ['notnull' => true]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['file_id'], 'honeycomb_folder_summary_file');
		}
		if (!$schema->hasTable(self::DONE)) {
			$table = $schema->createTable(self::DONE);
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('done_at', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('photos', Types::INTEGER, ['notnull' => true]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['file_id'], 'honeycomb_folder_done_file');
		}
		return $schema;
	}
}
