<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Listener;

use OCA\Honeycomb\BackgroundJob\RenderPhotoTiers;
use OCA\Honeycomb\Domain\PhotoFiles;
use OCA\Honeycomb\Service\AppVisits;
use OCP\BackgroundJob\IJobList;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Files\Events\Node\NodeWrittenEvent;
use OCP\Files\File;

/**
 * Queues the rendering of the tiers of a photo written below the files of a user who opened honeycomb (IMAGES-001.16, ADR 0045).
 * @template-implements IEventListener<Event>
 */
final class RenderWrittenPhotos implements IEventListener {
	/** A path below a user's files: `/<user id>/files/...`. */
	private const string USER_FILES = '#^/([^/]+)/files/#';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private AppVisits $visits,
		private IJobList $jobs,
	) {
	}

	#[\Override]
	public function handle(Event $event): void {
		if (!$event instanceof NodeWrittenEvent) {
			return;
		}
		$node = $event->getNode();
		if (!$node instanceof File || !PhotoFiles::isPhoto($node) || preg_match(self::USER_FILES, $node->getPath(), $match) !== 1) {
			return;
		}
		$argument = ['userId' => $match[1], 'fileId' => $node->getId()];
		if ($this->visits->opened($match[1]) && !$this->jobs->has(RenderPhotoTiers::class, $argument)) {
			$this->jobs->add(RenderPhotoTiers::class, $argument);
		}
	}
}
