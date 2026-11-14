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
 * Creates the visual hash table (ADR 0024).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000002Date20261114120000 extends SimpleMigrationStep {
	/** Nextcloud's user id column width. */
	private const int USER_ID_LENGTH = 64;
	/** 16 hex digits of a 64-bit dHash. */
	private const int HASH_LENGTH = 16;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('honeycomb_hashes')) {
			$table = $schema->createTable('honeycomb_hashes');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('etag', Types::STRING, ['notnull' => true, 'length' => VisualHash::MAX_ETAG_LENGTH]);
			$table->addColumn('hash', Types::STRING, ['notnull' => true, 'length' => self::HASH_LENGTH]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id', 'file_id'], 'honeycomb_hashes_user_file');
		}
		return $schema;
	}
}
