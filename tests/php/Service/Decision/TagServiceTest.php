<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Decision;

use OCA\Honeycomb\Service\Decision\TagService;
use OCA\Honeycomb\Tests\Service\FakeTagStore;
use OCP\IUser;
use PHPUnit\Framework\TestCase;

final class TagServiceTest extends TestCase {
	private function user(string $uid): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn($uid);
		return $user;
	}

	// spec: TAGS-001.5
	public function testTheTagListKeepsEveryTagAddedSortedAndOnce(): void {
		$store = new FakeTagStore();
		$store->addToTagList('alice', ['Places/Italy', 'Anna']);
		$store->addToTagList('alice', ['Anna']);
		$store->addToTagList('bob', ['Bob']);

		$this->assertSame(['Anna', 'Places/Italy'], (new TagService($store))->tagList($this->user('alice')));
	}
}
