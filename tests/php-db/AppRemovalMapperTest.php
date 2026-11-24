<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OC\DB\Connection;
use OC\DB\MigrationService;
use OCA\Honeycomb\BackgroundJob\RenderPhotoTiers;
use OCA\Honeycomb\BackgroundJob\SweepVanishedRows;
use OCA\Honeycomb\Db\AppDataMapper;
use OCA\Honeycomb\Db\AppRemovalMapper;
use OCP\BackgroundJob\IJobList;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IAppConfig;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\Server;
use PHPUnit\Framework\TestCase;

/** Dropping the app's tables and deleting its rows of the shared tables, and nothing of other apps; each test installs the schema again. */
final class AppRemovalMapperTest extends TestCase {
	private const string APP = 'honeycomb';
	private const string OTHER_APP = 'other-app';
	private const string LEGACY_TABLE = 'honeycomb_flags';

	private IDBConnection $db;
	private IAppConfig $config;
	private IJobList $jobs;
	private string $installedVersion;

	#[\Override]
	protected function setUp(): void {
		$this->db = Server::get(IDBConnection::class);
		$this->config = Server::get(IAppConfig::class);
		$this->jobs = Server::get(IJobList::class);
		$this->installedVersion = $this->config->getValueString(self::APP, 'installed_version');
	}

	/** @psalm-suppress UndefinedClass, InternalClass, InternalMethod The migration runner is not public API; only this test installs the schema again. */
	#[\Override]
	protected function tearDown(): void {
		$this->deletePreferences();
		(new AppRemovalMapper($this->db, $this->config, $this->jobs))->remove();
		(new MigrationService(self::APP, Server::get(Connection::class)))->migrate();
		$this->config->setValueString(self::APP, 'enabled', 'yes');
		$this->config->setValueString(self::APP, 'installed_version', $this->installedVersion);
		$this->jobs->add(SweepVanishedRows::class);
	}

	private function deletePreferences(): void {
		$query = $this->db->getQueryBuilder();
		$query->delete('preferences')->where($query->expr()->in('appid', $query->createNamedParameter([self::APP, self::OTHER_APP], IQueryBuilder::PARAM_STR_ARRAY)))->executeStatement();
	}

	private function preference(string $app): void {
		$query = $this->db->getQueryBuilder();
		$query->insert('preferences')->values([
			'userid' => $query->createNamedParameter('alice'),
			'appid' => $query->createNamedParameter($app),
			'configkey' => $query->createNamedParameter('key'),
			'configvalue' => $query->createNamedParameter('value'),
		])->executeStatement();
	}

	private function rows(string $table, string $column, string $app): int {
		$query = $this->db->getQueryBuilder();
		$query->select($query->func()->count('*'))->from($table)->where($query->expr()->eq($column, $query->createNamedParameter($app)));
		return (int)$query->executeQuery()->fetchOne();
	}

	/** Everything an instance from before 0.2.0 holds: a legacy table, a preference, both jobs and the app config. */
	private function installedData(): void {
		$this->db->executeStatement('CREATE TABLE *PREFIX*' . self::LEGACY_TABLE . ' (id INTEGER)');
		$this->preference(self::APP);
		$this->preference(self::OTHER_APP);
		$this->jobs->add(RenderPhotoTiers::class, ['fileId' => 7]);
		$this->config->setValueString(self::APP, 'connections_file', '/srv/immich.json');
	}

	/**
	 * @return list<string> the app's tables in the live schema, without schema and prefix
	 * @psalm-suppress UndefinedClass, MixedAssignment, MixedArgument Doctrine's schema is not in the stubs.
	 */
	private function schemaTables(): array {
		$prefix = Server::get(IConfig::class)->getSystemValueString('dbtableprefix', 'oc_');
		$tables = [];
		foreach ($this->db->createSchema()->getTableNames() as $name) {
			if (preg_match('/(?:^|\.)' . preg_quote($prefix, '/') . '(honeycomb_\w+)$/', (string)$name, $match) === 1) {
				$tables[] = $match[1];
			}
		}
		return $tables;
	}

	// spec: DECISIONS-001.38
	public function testRemovesTablesMigrationsPreferencesJobsAndConfigOfHoneycombOnly(): void {
		$this->installedData();
		$coreMigrations = $this->rows('migrations', 'app', 'core');
		$removal = new AppRemovalMapper($this->db, $this->config, $this->jobs);

		$this->assertEqualsCanonicalizing([...AppDataMapper::TABLES, self::LEGACY_TABLE], $removal->tables());
		$this->assertEqualsCanonicalizing([...AppDataMapper::TABLES, self::LEGACY_TABLE], $removal->remove());

		$this->assertSame([], $this->schemaTables());
		$this->assertSame(0, $this->rows('migrations', 'app', self::APP));
		$this->assertSame($coreMigrations, $this->rows('migrations', 'app', 'core'));
		$this->assertSame(0, $this->rows('preferences', 'appid', self::APP));
		$this->assertSame(1, $this->rows('preferences', 'appid', self::OTHER_APP));
		$this->assertFalse($this->jobs->has(SweepVanishedRows::class, null));
		$this->assertSame(0, $this->rows('jobs', 'class', RenderPhotoTiers::class));
		$this->assertSame([], $this->config->getKeys(self::APP));
		$this->assertSame([], $removal->remove());
	}

	// spec: DECISIONS-001.39
	public function testDroppingTheTablesKeepsThePreferencesJobsAndConfig(): void {
		$this->installedData();
		$removal = new AppRemovalMapper($this->db, $this->config, $this->jobs);

		$this->assertEqualsCanonicalizing([...AppDataMapper::TABLES, self::LEGACY_TABLE], $removal->dropTables());

		$this->assertSame([], $this->schemaTables());
		$this->assertSame(0, $this->rows('migrations', 'app', self::APP));
		$this->assertSame(1, $this->rows('preferences', 'appid', self::APP));
		$this->assertTrue($this->jobs->has(SweepVanishedRows::class, null));
		$this->assertSame('/srv/immich.json', $this->config->getValueString(self::APP, 'connections_file'));
		$this->assertSame([], $removal->dropTables());
	}

	// spec: DECISIONS-001.38
	public function testEveryHoneycombTableTheMigrationsCreateIsDropped(): void {
		$tables = $this->schemaTables();
		$this->assertNotSame([], $tables);

		$this->assertEqualsCanonicalizing($tables, (new AppRemovalMapper($this->db, $this->config, $this->jobs))->tables());
	}

	// spec: DECISIONS-001.38
	public function testAFailedDropKeepsTheAppConfigSoTheCommandRunsAgain(): void {
		$connection = $this->createStub(IDBConnection::class);
		$connection->method('getQueryBuilder')->willReturnCallback(fn (): IQueryBuilder => $this->db->getQueryBuilder());
		$connection->method('tableExists')->willReturnCallback(fn (string $table): bool => $this->db->tableExists($table));
		$connection->method('dropTable')->willThrowException(new \RuntimeException('connection lost'));

		try {
			(new AppRemovalMapper($connection, $this->config, $this->jobs))->remove();
			$this->fail('The failure was swallowed.');
		} catch (\RuntimeException $e) {
			$this->assertSame('connection lost', $e->getMessage());
		}

		$this->assertSame('yes', $this->config->getValueString(self::APP, 'enabled'));
		$this->assertNotSame(0, $this->rows('migrations', 'app', self::APP));
	}
}
