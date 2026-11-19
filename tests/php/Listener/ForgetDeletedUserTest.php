<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Listener;

use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\ResumePosition;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\UserRowStores;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Tests\Service\FakeFlagStore;
use OCA\Honeycomb\Tests\Service\FakePositionStore;
use OCA\Honeycomb\Tests\Service\FakeSeriesStore;
use OCA\Honeycomb\Tests\Service\FakeStatsStore;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use OCA\Honeycomb\Tests\Service\XmpCacheRowTest;
use OCP\EventDispatcher\Event;
use OCP\IUser;
use OCP\User\Events\UserDeletedEvent;
use PHPUnit\Framework\TestCase;

final class ForgetDeletedUserTest extends TestCase {
	private FakeFlagStore $flags;
	private FakePositionStore $positions;
	private FakeTagStore $tags;
	private FakeVisualHashStore $hashes;
	private FakeSeriesStore $series;
	private FakeXmpCacheStore $xmpCache;
	private FakeStatsStore $stats;

	#[\Override]
	protected function setUp(): void {
		$this->flags = new FakeFlagStore();
		$this->flags->rows[7] = new FileFlag(7, Flag::Picked, false, 100);
		$this->positions = new FakePositionStore();
		$this->tags = new FakeTagStore();
		$this->hashes = new FakeVisualHashStore();
		$this->series = new FakeSeriesStore();
		$this->xmpCache = new FakeXmpCacheStore();
		$this->stats = new FakeStatsStore();
		foreach (['alice', 'bob'] as $userId) {
			$this->tags->addToTagList($userId, ['Anna']);
			$this->hashes->replace($userId, [new VisualHash(7, 'etag-7', '0000000000000007')]);
			$this->series->add($userId, SeriesStatus::Open, 7, 8);
			$this->xmpCache->replace($userId, [XmpCacheRow::fromRequest(XmpCacheRowTest::item())]);
			$this->positions->save($userId, new ResumePosition(new FolderSet(['/Trip'], false), 7, 1, 2, 0));
			$this->stats->rows[$userId] = ['2026-11-19' => ['series_done' => 1]];
		}
	}

	private function registry(): UserRowStores {
		return new UserRowStores($this->hashes, $this->series, $this->xmpCache, $this->tags, $this->positions, $this->stats);
	}

	private function deleted(string $userId): UserDeletedEvent {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($userId);
		return new UserDeletedEvent($user);
	}

	// spec: DECISIONS-001.33, DECISIONS-002.13, TAGS-001.12, SERIES-003.11, SERIES-005.25, XMP-006.8, STATS-001.28
	public function testForgetsTheRowsOfTheDeletedUserOnlyAndLeavesTheFlags(): void {
		(new ForgetDeletedUser($this->registry()))->handle($this->deleted('alice'));

		$this->assertSame([7], array_keys($this->flags->find([7])));
		$this->assertSame([], $this->positions->all('alice'));
		$this->assertCount(1, $this->positions->all('bob'));
		$this->assertSame([], $this->tags->tagList('alice'));
		$this->assertSame(['Anna'], $this->tags->tagList('bob'));
		$this->assertSame([], $this->hashes->find('alice', [7]));
		$this->assertCount(1, $this->hashes->find('bob', [7]));
		$this->assertArrayNotHasKey('alice', $this->series->rows);
		$this->assertSame([], $this->xmpCache->find('alice', [9]));
		$this->assertCount(1, $this->xmpCache->find('bob', [9]));
		$this->assertSame(['bob'], array_keys($this->stats->rows));
		$this->assertSame(['bob'], array_values(array_unique(array_column($this->series->series, 'userId'))));
	}

	public function testIgnoresAnotherEvent(): void {
		(new ForgetDeletedUser($this->registry()))->handle(new Event());

		$this->assertSame(['Anna'], $this->tags->tagList('alice'));
		$this->assertCount(1, $this->positions->all('alice'));
	}
}
