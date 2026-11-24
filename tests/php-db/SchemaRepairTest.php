<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OC\DB\Connection;
use OC\DB\MigrationService;
use OC\DB\SchemaWrapper;
use OCA\Honeycomb\Db\AppRemovalMapper;
use OCP\BackgroundJob\IJobList;
use OCP\IAppConfig;
use OCP\IDBConnection;
use OCP\Server;
use PHPUnit\Framework\TestCase;

/**
 * A test server that ran the first 0.2.0 baseline, before it gained columns, reaches today's schema by the migrations (ADR 0055).
 * @psalm-suppress UndefinedClass, InternalClass, InternalMethod, MixedMethodCall The migration runner and schema wrapper are not public API.
 */
final class SchemaRepairTest extends TestCase {
	private const string APP = 'honeycomb';
	private const string BASELINE = '000200Date20261123200000';
	private const string FIRST_BASELINE = __DIR__ . '/../fixtures/schema/honeycomb-first-baseline.json';
	private const string FIXTURE = __DIR__ . '/../fixtures/schema/honeycomb.json';
	/** `string(64) null default x autoincrement`: the type, its length, the null rule and the rest. */
	private const string COLUMN = '/^(\w+)(?:\((\d+)\))? (notnull|null)(?: default (\S+))?( autoincrement)?$/';
	/** `unique(a, b)`: the kind and its columns. */
	private const string INDEX = '/^(\w+)\((.*)\)$/';

	private IDBConnection $db;
	private IAppConfig $config;
	private IJobList $jobs;

	#[\Override]
	protected function setUp(): void {
		$this->db = Server::get(IDBConnection::class);
		$this->config = Server::get(IAppConfig::class);
		$this->jobs = Server::get(IJobList::class);
	}

	#[\Override]
	protected function tearDown(): void {
		$this->removal()->dropTables();
		$this->migrate();
	}

	public function testTheMigrationsBringTheFirstBaselineToTheSchemaOfTheFixture(): void {
		$this->installFirstBaseline();

		$this->migrate();

		$this->assertSame(json_encode($this->fixture(self::FIXTURE), JSON_PRETTY_PRINT), json_encode(SchemaSnapshot::live(), JSON_PRETTY_PRINT));
	}

	public function testTheRowsOfTheFirstBaselineKeepTheirValuesAndGetTheDefaults(): void {
		$this->installFirstBaseline();
		$this->db->executeStatement("INSERT INTO *PREFIX*honeycomb_hashes (file_id, etag, hash) VALUES (7, 'e7', 'ffff0000ffff0000')");
		$this->db->executeStatement("INSERT INTO *PREFIX*honeycomb_decisions (source, file_id, user_id, flag, updated_at) VALUES ('files', 7, 'alice', 'pick', 100)");

		$this->migrate();

		$this->assertSame(['file_id' => 7, 'etag' => 'e7', 'method' => 1, 'hash' => 'ffff0000ffff0000'], $this->row('SELECT file_id, etag, method, hash FROM *PREFIX*honeycomb_hashes'));
		$this->assertSame(['file_id' => 7, 'flag' => 'pick', 'updated_by' => null, 'sidecar_etag' => null], $this->row('SELECT file_id, flag, updated_by, sidecar_etag FROM *PREFIX*honeycomb_decisions'));
	}

	private function removal(): AppRemovalMapper {
		return new AppRemovalMapper($this->db, $this->config, $this->jobs);
	}

	private function migrate(): void {
		(new MigrationService(self::APP, Server::get(Connection::class)))->migrate();
	}

	/** Drops today's tables and creates those of the first baseline, recorded as run, as a test server kept them. */
	private function installFirstBaseline(): void {
		$this->removal()->dropTables();
		$connection = Server::get(Connection::class);
		$schema = new SchemaWrapper($connection);
		foreach ($this->fixture(self::FIRST_BASELINE) as $name => ['columns' => $columns, 'indexes' => $indexes]) {
			$table = $schema->createTable($name);
			foreach ($columns as $column => $description) {
				self::assertSame(1, preg_match(self::COLUMN, $description, $match), $description);
				$table->addColumn($column, $match[1], array_filter([
					'length' => ($match[2] ?? '') === '' ? null : (int)$match[2],
					'notnull' => $match[3] === 'notnull',
					'default' => self::default($match[4] ?? ''),
					'autoincrement' => ($match[5] ?? '') !== '',
				], static fn (mixed $option): bool => $option !== null));
			}
			foreach ($indexes as $index => $description) {
				self::assertSame(1, preg_match(self::INDEX, $description, $match), $description);
				$keys = explode(', ', $match[2]);
				match ($match[1]) {
					SchemaSnapshot::PRIMARY => $table->setPrimaryKey($keys),
					'unique' => $table->addUniqueIndex($keys, $index),
					default => $table->addIndex($keys, $index),
				};
			}
		}
		$connection->migrateToSchema($schema->getWrappedSchema());
		$this->db->executeStatement('INSERT INTO *PREFIX*migrations (app, version) VALUES (?, ?)', [self::APP, self::BASELINE]);
	}

	private static function default(string $value): bool|int|string|null {
		return match (true) {
			$value === '' => null,
			$value === 'false' => false,
			ctype_digit($value) => (int)$value,
			default => $value,
		};
	}

	/**
	 * @psalm-suppress ForbiddenCode Reads a schema fixture, not a user file.
	 * @return array<string, array{columns: array<string, string>, indexes: array<string, string>}>
	 */
	private function fixture(string $path): array {
		/** @var array<string, array{columns: array<string, string>, indexes: array<string, string>}> */
		return json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
	}

	/** @return array<string, mixed> the one row the query answers, numbers as integers */
	private function row(string $sql): array {
		$row = $this->db->executeQuery($sql)->fetch();
		self::assertIsArray($row);
		return array_map(static fn (mixed $value): mixed => is_string($value) && ctype_digit($value) ? (int)$value : $value, $row);
	}
}
