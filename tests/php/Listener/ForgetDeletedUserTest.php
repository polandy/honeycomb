<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Listener;

use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\ResumePosition;
use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCA\Honeycomb\Tests\Service\FakePositionStore;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCA\Honeycomb\Tests\Service\FakeVisualHashStore;
use OCP\EventDispatcher\Event;
use OCP\IUser;
use OCP\User\Events\UserDeletedEvent;
use PHPUnit\Framework\TestCase;

final class ForgetDeletedUserTest extends TestCase {
	private FakeDecisionStore $decisions;
	private FakePositionStore $positions;
	private FakeTagStore $tags;
	private FakeVisualHashStore $hashes;

	#[\Override]
	protected function setUp(): void {
		$this->decisions = new FakeDecisionStore();
		$this->positions = new FakePositionStore();
		$this->tags = new FakeTagStore();
		$this->hashes = new FakeVisualHashStore();
		foreach (['alice', 'bob'] as $userId) {
			$this->decisions->replace($userId, [7], [new PictureDecision(7, 3, null, Flag::Picked, false)]);
			$this->tags->replace($userId, [7], [new PictureTags(7, ['Anna'])]);
			$this->hashes->replace($userId, [new VisualHash(7, 'etag-7', '0000000000000007')]);
			$this->positions->save($userId, new ResumePosition(new FolderSet(['/Trip'], false), 7, 1, 2, 0));
		}
	}

	private function deleted(string $userId): UserDeletedEvent {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($userId);
		return new UserDeletedEvent($user);
	}

	// spec: DECISIONS-001.12, DECISIONS-002.13, TAGS-001.12, SERIES-003.11
	public function testForgetsTheDecisionsAndPositionsOfTheDeletedUserOnly(): void {
		(new ForgetDeletedUser($this->decisions, $this->positions, $this->tags, $this->hashes))->handle($this->deleted('alice'));

		$this->assertSame([], $this->decisions->find('alice', [7]));
		$this->assertSame([], $this->positions->all('alice'));
		$this->assertCount(1, $this->decisions->find('bob', [7]));
		$this->assertCount(1, $this->positions->all('bob'));
		$this->assertSame([], $this->tags->find('alice', [7]));
		$this->assertSame([], $this->tags->tagList('alice'));
		$this->assertSame(['Anna'], $this->tags->tagList('bob'));
		$this->assertSame([], $this->hashes->find('alice', [7]));
		$this->assertCount(1, $this->hashes->find('bob', [7]));
	}

	public function testIgnoresAnotherEvent(): void {
		(new ForgetDeletedUser($this->decisions, $this->positions, $this->tags, $this->hashes))->handle(new Event());

		$this->assertCount(1, $this->decisions->find('alice', [7]));
		$this->assertCount(1, $this->positions->all('alice'));
	}
}
