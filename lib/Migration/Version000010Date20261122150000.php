<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Lets a done status outlive the user who marked it (ADR 0040, Who shares what).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000010Date20261122150000 extends SimpleMigrationStep {
	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		$column = $schema->getTable('honeycomb_folder_done')->getColumn('user_id');
		if (!$column->getNotnull()) {
			return null;
		}
		$column->setNotnull(false);
		return $schema;
	}
}
