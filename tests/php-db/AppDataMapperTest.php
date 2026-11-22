<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\AppDataMapper;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\Server;

/** Counting and emptying everything the app stores, and nothing of other apps. */
final class AppDataMapperTest extends DbTestCase {
	private const string OTHER_APP = 'other-app';

	private AppDataMapper $data;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->data = new AppDataMapper($this->db);
		$this->deletePreferences();
	}

	#[\Override]
	protected function tearDown(): void {
		$this->deletePreferences();
	}

	private function deletePreferences(): void {
		$query = $this->db->getQueryBuilder();
		$query->delete('preferences')->where($query->expr()->in('appid', $query->createNamedParameter(['honeycomb', self::OTHER_APP], IQueryBuilder::PARAM_STR_ARRAY)))->executeStatement();
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

	private function remainingPreferences(string $app): int {
		$query = $this->db->getQueryBuilder();
		$query->select($query->func()->count('*'))->from('preferences')->where($query->expr()->eq('appid', $query->createNamedParameter($app)));
		return (int)$query->executeQuery()->fetchOne();
	}

	// spec: DECISIONS-001.35
	public function testCountsDeletesNothingAndEmptyingRemovesOnlyHoneycombRows(): void {
		(new FlagMapper($this->db))->save([new FileFlag(7, Flag::Picked, false, 100)]);
		$this->preference('honeycomb');
		$this->preference(self::OTHER_APP);

		$counts = $this->data->count();
		$this->assertCount(13, $counts);
		$this->assertSame([], array_filter(array_diff_key($counts, ['honeycomb_flags' => 1, 'preferences' => 1])));
		$this->assertSame(1, $counts['honeycomb_flags']);
		$this->assertSame(1, $counts['preferences']);
		$this->assertSame(1, $this->data->count()['honeycomb_flags']);

		$removed = $this->data->empty();

		$this->assertSame(1, $removed['honeycomb_flags']);
		$this->assertSame(1, $removed['preferences']);
		$this->assertSame(0, $this->data->count()['honeycomb_flags']);
		$this->assertSame(0, $this->remainingPreferences('honeycomb'));
		$this->assertSame(1, $this->remainingPreferences(self::OTHER_APP));
	}

	// spec: DECISIONS-001.35
	public function testEveryHoneycombTableInTheSchemaIsCountedAndEmptied(): void {
		$schema = new \OC\DB\SchemaWrapper(Server::get(\OC\DB\Connection::class));
		$prefix = Server::get(IConfig::class)->getSystemValueString('dbtableprefix', 'oc_');
		$names = array_map(static fn (string $name): string => str_starts_with($name, $prefix) ? substr($name, strlen($prefix)) : $name, $schema->getTableNames());
		$tables = array_values(array_filter($names, static fn (string $name): bool => str_starts_with($name, 'honeycomb_')));
		$this->assertNotSame([], $tables);

		$this->assertEqualsCanonicalizing($tables, array_values(array_diff(array_keys($this->data->count()), ['preferences'])));
		$this->assertEqualsCanonicalizing($tables, array_values(array_diff(array_keys($this->data->empty()), ['preferences'])));
	}

	// spec: DECISIONS-001.35
	public function testAFailureHalfwayRollsEveryDeletionBack(): void {
		(new FlagMapper($this->db))->save([new FileFlag(7, Flag::Picked, false, 100)]);
		$this->preference('honeycomb');
		$builders = 0;
		$failing = $this->createMock(IQueryBuilder::class);
		$failing->method('delete')->willReturnSelf();
		$failing->method('executeStatement')->willThrowException(new \RuntimeException('connection lost'));
		$connection = $this->createMock(IDBConnection::class);
		$connection->method('getQueryBuilder')->willReturnCallback(function () use (&$builders, $failing): IQueryBuilder {
			return ++$builders === 3 ? $failing : $this->db->getQueryBuilder();
		});
		$connection->method('beginTransaction')->willReturnCallback(fn () => $this->db->beginTransaction());
		$connection->method('commit')->willReturnCallback(fn () => $this->db->commit());
		$connection->method('rollBack')->willReturnCallback(fn () => $this->db->rollBack());

		try {
			(new AppDataMapper($connection))->empty();
			$this->fail('The failure was swallowed.');
		} catch (\RuntimeException $e) {
			$this->assertSame('connection lost', $e->getMessage());
		}

		$this->assertSame(1, $this->data->count()['honeycomb_flags']);
		$this->assertSame(1, $this->remainingPreferences('honeycomb'));
	}
}
