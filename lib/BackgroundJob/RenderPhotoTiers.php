<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\BackgroundJob;

use OCA\Honeycomb\Service\ImageService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\QueuedJob;
use OCP\IUserManager;
use Psr\Log\LoggerInterface;

/** Renders the three tiers of one written photo, so a folder opened later shows rendered previews (IMAGES-001.16, ADR 0045). */
final class RenderPhotoTiers extends QueuedJob {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it from the job list. */
	public function __construct(
		ITimeFactory $time,
		private IUserManager $users,
		private ImageService $images,
		private LoggerInterface $logger,
	) {
		parent::__construct($time);
	}

	/** @param mixed $argument `['userId' => string, 'fileId' => int]`, as `RenderWrittenPhotos` queues it */
	#[\Override]
	protected function run($argument): void {
		$userId = is_array($argument) ? ($argument['userId'] ?? null) : null;
		$fileId = is_array($argument) ? ($argument['fileId'] ?? null) : null;
		if (!is_string($userId) || !is_int($fileId)) {
			$this->logger->warning('Render job without a user and a file id', ['argument' => $argument]);
			return;
		}
		$user = $this->users->get($userId);
		if ($user !== null) {
			$this->images->warm($user, [$fileId]);
		}
	}
}
