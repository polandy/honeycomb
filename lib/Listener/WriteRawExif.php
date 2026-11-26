<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Listener;

use DateTimeZone;
use OCA\Honeycomb\Service\App\AppVisits;
use OCA\Honeycomb\Service\Listing\RawExif;
use OCA\Honeycomb\Service\Listing\RawExifReader;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Files\File;
use OCP\FilesMetadata\AMetadataEvent;
use OCP\FilesMetadata\Event\MetadataLiveEvent;

/**
 * Writes the capture time and camera of a RAW file of a user who opened honeycomb into its file metadata (LISTING-004, ADR 0061).
 * @template-implements IEventListener<Event>
 */
final class WriteRawExif implements IEventListener {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private AppVisits $visits,
		private SettingsService $settings,
		private RawExifReader $reader,
	) {
	}

	#[\Override]
	public function handle(Event $event): void {
		if (!$event instanceof AMetadataEvent) {
			return;
		}
		$node = $event->getNode();
		$owner = $node->getOwner()?->getUID();
		if (!$node instanceof File || $owner === null || !$this->visits->opened($owner)
			|| $this->settings->pairing($owner)->roleOf(pathinfo($node->getName(), PATHINFO_EXTENSION)) !== 'raw') {
			return;
		}
		if ($event instanceof MetadataLiveEvent && !$node->getStorage()->isLocal()) {
			$event->requestBackgroundJob();
			return;
		}
		$value = $this->reader->read($node, new DateTimeZone(date_default_timezone_get()));
		if ($value !== null) {
			$event->getMetadata()->setArray(RawExif::KEY, $value);
		}
	}
}
