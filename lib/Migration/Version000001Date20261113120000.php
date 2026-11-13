<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Service\PictureTags;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Creates the tag and tag list tables (ADR 0022).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000001Date20261113120000 extends SimpleMigrationStep {
	/** Nextcloud's user id column width. */
	private const int USER_ID_LENGTH = 64;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('honeycomb_file_tags')) {
			$table = $schema->createTable('honeycomb_file_tags');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('tags', Types::TEXT, ['notnull' => true]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id', 'file_id'], 'honeycomb_file_tags_user_file');
		}
		if (!$schema->hasTable('honeycomb_tag_list')) {
			$table = $schema->createTable('honeycomb_tag_list');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('tag', Types::STRING, ['notnull' => true, 'length' => PictureTags::MAX_LENGTH]);
			$table->setPrimaryKey(['id']);
			$table->addIndex(['user_id'], 'honeycomb_tag_list_user');
		}
		return $schema;
	}
}
