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
 * Creates the XMP cache table (ADR 0032).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000004Date20261115120000 extends SimpleMigrationStep {
	/** Nextcloud's user id column width. */
	private const int USER_ID_LENGTH = 64;
	/** Wide enough for every `XmpSource`, `XmpReadState`, `Flag` and `ColourLabel` value. */
	private const int VALUE_LENGTH = 16;
	/** The width of a refusal reason, as `XmpCacheRow` checks it. */
	private const int REASON_LENGTH = 32;

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('honeycomb_xmp_cache')) {
			$table = $schema->createTable('honeycomb_xmp_cache');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('user_id', Types::STRING, ['notnull' => true, 'length' => self::USER_ID_LENGTH]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('kind', Types::STRING, ['notnull' => true, 'length' => self::VALUE_LENGTH]);
			$table->addColumn('etag', Types::STRING, ['notnull' => true, 'length' => VisualHash::MAX_ETAG_LENGTH]);
			$table->addColumn('reader', Types::INTEGER, ['notnull' => true]);
			$table->addColumn('state', Types::STRING, ['notnull' => true, 'length' => self::VALUE_LENGTH]);
			$table->addColumn('reason', Types::STRING, ['notnull' => false, 'length' => self::REASON_LENGTH]);
			$table->addColumn('rating', Types::SMALLINT, ['notnull' => false]);
			$table->addColumn('flag', Types::STRING, ['notnull' => false, 'length' => self::VALUE_LENGTH]);
			$table->addColumn('colour_label', Types::STRING, ['notnull' => false, 'length' => self::VALUE_LENGTH]);
			$table->addColumn('keep_raw', Types::BOOLEAN, ['notnull' => false]);
			$table->addColumn('tags', Types::TEXT, ['notnull' => false]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id', 'file_id'], 'honeycomb_xmp_user_file');
		}
		return $schema;
	}
}
