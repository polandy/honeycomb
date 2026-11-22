<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Listener;

use OCA\Honeycomb\Service\UserRowStores;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\User\Events\UserDeletedEvent;

/**
 * Removes the resume positions, tag list, XMP cache, series and done statuses of a deleted user; the flags, visual hashes and quality values stay.
 * @template-implements IEventListener<Event>
 */
final class ForgetDeletedUser implements IEventListener {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private UserRowStores $stores,
	) {
	}

	#[\Override]
	public function handle(Event $event): void {
		if (!$event instanceof UserDeletedEvent) {
			return;
		}
		foreach ($this->stores->all() as $store) {
			$store->forgetUser($event->getUid());
		}
	}
}
