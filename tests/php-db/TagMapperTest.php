<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\TagMapper;
use OCP\DB\Exception as DbException;

/** The tag list against a real database. */
final class TagMapperTest extends DbTestCase {
	private const string TABLE = 'honeycomb_tag_list';

	private TagMapper $tags;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->tags = new TagMapper($this->db);
	}

	public function testAddingAKnownTagKeepsOneRow(): void {
		$this->tags->addToTagList('alice', ['beach', 'beach']);
		$this->tags->addToTagList('alice', ['beach', 'sunset']);
		$this->tags->addToTagList('bob', ['beach']);

		$this->assertSame(['beach', 'sunset'], $this->tags->tagList('alice'));
		$this->assertSame(['beach'], $this->tags->tagList('bob'));
		$this->assertSame(3, $this->rowCount());
	}

	// ADR 0022: the key must not fold case or accents, as the comparison is PHP's.
	public function testTagsThatDifferOnlyInCaseOrAccentsAreTwoRows(): void {
		$this->tags->addToTagList('alice', ['anna', 'cafe']);
		$this->tags->addToTagList('alice', ['Anna']);
		$this->tags->addToTagList('alice', ['café']);

		$this->assertSame(['Anna', 'anna', 'cafe', 'café'], $this->tags->tagList('alice'));
	}

	public function testASecondInsertOfTheSameTagIsAUniqueConflict(): void {
		$this->insertRow('alice', 'beach');

		try {
			$this->insertRow('alice', 'beach');
			$this->fail('the unique index let a second row in');
		} catch (DbException $e) {
			$this->assertSame(DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION, $e->getReason());
		}
	}

	private function insertRow(string $userId, string $tag): void {
		$query = $this->db->getQueryBuilder();
		$query->insert(self::TABLE)
			->values(['user_id' => $query->createNamedParameter($userId), 'tag' => $query->createNamedParameter($tag)])
			->executeStatement();
	}

	private function rowCount(): int {
		$query = $this->db->getQueryBuilder();
		$query->select($query->func()->count('*'))->from(self::TABLE);
		$result = $query->executeQuery();
		$count = (int)$result->fetchOne();
		$result->closeCursor();
		return $count;
	}
}
