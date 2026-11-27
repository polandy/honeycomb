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
 * Adds to each Immich asset row what *Write to Immich* last wrote for it, null while nothing was written (IMMICH-004.21).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000200Date20261127180000 extends SimpleMigrationStep {
	private const string TABLE = 'honeycomb_immich_assets';
	private const int WORD_LENGTH = 16;
	/** @var array<string, array{string, array<string, bool|int>}> */
	private const array COLUMNS = [
		'written_flag' => [Types::STRING, ['notnull' => false, 'length' => self::WORD_LENGTH]],
		'written_rating' => [Types::SMALLINT, ['notnull' => false]],
		'written_immich_rating' => [Types::SMALLINT, ['notnull' => false]],
	];

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		$table = $schema->getTable(self::TABLE);
		$added = false;
		foreach (self::COLUMNS as $name => [$type, $column]) {
			if (!$table->hasColumn($name)) {
				$table->addColumn($name, $type, $column);
				$added = true;
			}
		}
		return $added ? $schema : null;
	}
}
