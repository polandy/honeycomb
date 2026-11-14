<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Listener;

use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\PositionStore;
use OCA\Honeycomb\Service\TagStore;
use OCA\Honeycomb\Service\VisualHashStore;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\User\Events\UserDeletedEvent;

/**
 * Removes the decisions, resume positions, tags, tag list and visual hashes of a deleted user.
 * @template-implements IEventListener<Event>
 */
final class ForgetDeletedUser implements IEventListener {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private DecisionStore $decisions,
		private PositionStore $positions,
		private TagStore $tags,
		private VisualHashStore $visualHashes,
	) {
	}

	#[\Override]
	public function handle(Event $event): void {
		if (!$event instanceof UserDeletedEvent) {
			return;
		}
		$this->decisions->forgetUser($event->getUid());
		$this->positions->forgetUser($event->getUid());
		$this->tags->forgetUser($event->getUid());
		$this->visualHashes->forgetUser($event->getUid());
	}
}
