<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Db;

use OCA\Honeycomb\Db\InsertStatement;
use OCA\Honeycomb\Db\InsertStatements;
use OCP\IDBConnection;
use PHPUnit\Framework\TestCase;

final class InsertStatementsTest extends TestCase {
	/** The statements pass the types on; `IQueryBuilder`'s need Doctrine, which only Nextcloud ships. */
	private const array COLUMNS = ['user_id' => 'text', 'file_id' => 'number'];

	/** @return list<array<string, int|string>> */
	private static function rows(int $count): array {
		return array_map(static fn (int $fileId): array => ['file_id' => $fileId, 'user_id' => 'alice'], range(1, $count));
	}

	/** @return list<InsertStatement> */
	private static function statements(int $rows, string $provider = IDBConnection::PLATFORM_MYSQL): array {
		return (new InsertStatements('honeycomb_decisions', self::COLUMNS))->of($rows === 0 ? [] : self::rows($rows), $provider);
	}

	public function testHasNoStatementForNoRows(): void {
		$this->assertSame([], self::statements(0));
	}

	public function testInsertsRowsInOneStatementInTheColumnOrder(): void {
		$this->assertEquals([new InsertStatement(
			'INSERT INTO `*PREFIX*honeycomb_decisions` (`user_id`, `file_id`) VALUES (?, ?), (?, ?)',
			['alice', 1, 'alice', 2],
			['text', 'number', 'text', 'number'],
		)], self::statements(2));
	}

	public function testFillsOneStatementWithAThousandRows(): void {
		$statements = self::statements(1_000);

		$this->assertCount(1, $statements);
		$this->assertCount(2_000, $statements[0]->params);
		$this->assertCount(2_000, $statements[0]->types);
	}

	public function testStartsAStatementAfterAThousandRows(): void {
		$statements = self::statements(1_001);

		$this->assertSame([2_000, 2], array_map(static fn (InsertStatement $statement): int => count($statement->params), $statements));
		$this->assertEquals(new InsertStatement(
			'INSERT INTO `*PREFIX*honeycomb_decisions` (`user_id`, `file_id`) VALUES (?, ?)',
			['alice', 1_001],
			['text', 'number'],
		), $statements[1]);
	}

	public function testInsertsOneRowPerStatementOnOracle(): void {
		$statements = self::statements(2, IDBConnection::PLATFORM_ORACLE);

		$this->assertSame([['alice', 1], ['alice', 2]], array_map(static fn (InsertStatement $statement): array => $statement->params, $statements));
	}

	public function testRejectsARowWithoutAColumn(): void {
		$this->expectException(\InvalidArgumentException::class);

		(new InsertStatements('honeycomb_decisions', self::COLUMNS))->of([['user_id' => 'alice']], IDBConnection::PLATFORM_MYSQL);
	}
}
