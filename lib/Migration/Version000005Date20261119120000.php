<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Service\DecidedPictures;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\IDBConnection;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Keeps one flag per file in `honeycomb_flags` and drops the decisions and file tags per user (ADR 0040).
 * @psalm-suppress UnusedClass Nextcloud runs it by its name.
 */
final class Version000005Date20261119120000 extends SimpleMigrationStep {
	private const string DECISIONS = 'honeycomb_decisions';
	/** Wide enough for every `Flag` value. */
	private const int FLAG_LENGTH = 16;

	public function __construct(
		private IDBConnection $db,
		private IUserConfig $config,
		private ITimeFactory $time,
	) {
	}

	/** Writes each user's start value while the decisions can still be read (ADR 0039). */
	#[\Override]
	public function preSchemaChange(IOutput $output, \Closure $schemaClosure, array $options): void {
		$schema = $schemaClosure();
		if (!$schema->hasTable(self::DECISIONS)) {
			return;
		}
		$query = $this->db->getQueryBuilder();
		$query->select('d.user_id', 'd.flag', 'f.parent', 'f.name')
			->from(self::DECISIONS, 'd')
			->leftJoin('d', 'filecache', 'f', $query->expr()->eq('f.fileid', 'd.file_id'));
		$result = $query->executeQuery();
		$rows = [];
		while (($row = $result->fetch()) !== false) {
			$rows[] = [
				'userId' => (string)$row['user_id'],
				'flag' => (string)$row['flag'],
				'parent' => $row['parent'] === null ? null : (int)$row['parent'],
				'name' => $row['name'] === null ? null : (string)$row['name'],
			];
		}
		$result->closeCursor();
		$day = $this->time->getDateTime()->format('Y-m-d');
		foreach (DecidedPictures::count($rows) as $userId => $count) {
			$this->config->setValueString((string)$userId, Application::APP_ID, DecidedPictures::KEY, json_encode(['count' => $count, 'day' => $day], JSON_THROW_ON_ERROR));
		}
	}

	#[\Override]
	public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('honeycomb_flags')) {
			$table = $schema->createTable('honeycomb_flags');
			$table->addColumn('id', Types::BIGINT, ['autoincrement' => true, 'notnull' => true]);
			$table->addColumn('file_id', Types::BIGINT, ['notnull' => true]);
			$table->addColumn('flag', Types::STRING, ['notnull' => true, 'length' => self::FLAG_LENGTH]);
			$table->addColumn('keep_raw', Types::BOOLEAN, ['notnull' => false, 'default' => false]);
			$table->addColumn('updated_at', Types::BIGINT, ['notnull' => true]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['file_id'], 'honeycomb_flags_file');
		}
		foreach ([self::DECISIONS, 'honeycomb_file_tags'] as $dropped) {
			if ($schema->hasTable($dropped)) {
				$schema->dropTable($dropped);
			}
		}
		return $schema;
	}
}
