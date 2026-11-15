<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\DecisionMapper;
use OCA\Honeycomb\Db\TagMapper;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\PictureTags;

/** The legacy row reads and removals of the decision and tag mappers (XMP-007). */
final class LegacyRowsTest extends DbTestCase {
	private DecisionMapper $decisions;
	private TagMapper $tags;

	#[\Override]
	protected function setUp(): void {
		parent::setUp();
		$this->decisions = new DecisionMapper($this->db);
		$this->tags = new TagMapper($this->db);
	}

	/** @param list<int> $fileIds */
	private function store(string $userId, array $fileIds): void {
		$this->decisions->replace($userId, $fileIds, array_map(static fn (int $id): PictureDecision => new PictureDecision($id, 2, ColourLabel::Red, Flag::Picked, true), $fileIds));
		$this->tags->replace($userId, $fileIds, array_map(static fn (int $id): PictureTags => new PictureTags($id, ['Anna']), $fileIds));
	}

	// spec: XMP-007.1
	public function testListsTheUsersFileIdsInOrder(): void {
		$this->store('alice', [9, 7]);
		$this->store('bob', [8]);
		$this->assertSame([7, 9], $this->decisions->fileIdsOf('alice'));
		$this->assertSame([7, 9], $this->tags->fileIdsOf('alice'));
	}

	// spec: XMP-007.3
	public function testForgetsOnlyTheUsersRowsOfTheFileIdsAndKeepsTheTagList(): void {
		$this->store('alice', [7, 9]);
		$this->store('bob', [7]);
		$this->decisions->forget('alice', [7]);
		$this->tags->forget('alice', [7]);
		$this->assertSame([9], $this->decisions->fileIdsOf('alice'));
		$this->assertSame([9], $this->tags->fileIdsOf('alice'));
		$this->assertSame([7], $this->decisions->fileIdsOf('bob'));
		$this->assertSame([7], $this->tags->fileIdsOf('bob'));
		$this->tags->forget('alice', [9]);
		$this->assertSame(['Anna'], $this->tags->tagList('alice'));
	}
}
