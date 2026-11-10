<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Listener;

use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\PictureDecision;
use OCA\Honeycomb\Service\ResumePosition;
use OCA\Honeycomb\Tests\Service\FakeDecisionStore;
use OCA\Honeycomb\Tests\Service\FakePositionStore;
use OCP\EventDispatcher\Event;
use OCP\IUser;
use OCP\User\Events\UserDeletedEvent;
use PHPUnit\Framework\TestCase;

final class ForgetDeletedUserTest extends TestCase {
	private FakeDecisionStore $decisions;
	private FakePositionStore $positions;

	#[\Override]
	protected function setUp(): void {
		$this->decisions = new FakeDecisionStore();
		$this->positions = new FakePositionStore();
		foreach (['alice', 'bob'] as $userId) {
			$this->decisions->replace($userId, [7], [new PictureDecision(7, 3, null, Flag::Picked, false)]);
			$this->positions->save($userId, new ResumePosition(new FolderSet(['/Trip'], false), 7, 1, 2, 0));
		}
	}

	private function deleted(string $userId): UserDeletedEvent {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($userId);
		return new UserDeletedEvent($user);
	}

	// spec: DECISIONS-001.12, DECISIONS-002.13
	public function testForgetsTheDecisionsAndPositionsOfTheDeletedUserOnly(): void {
		(new ForgetDeletedUser($this->decisions, $this->positions))->handle($this->deleted('alice'));

		$this->assertSame([], $this->decisions->find('alice', [7]));
		$this->assertSame([], $this->positions->all('alice'));
		$this->assertCount(1, $this->decisions->find('bob', [7]));
		$this->assertCount(1, $this->positions->all('bob'));
	}

	public function testIgnoresAnotherEvent(): void {
		(new ForgetDeletedUser($this->decisions, $this->positions))->handle(new Event());

		$this->assertCount(1, $this->decisions->find('alice', [7]));
		$this->assertCount(1, $this->positions->all('alice'));
	}
}
