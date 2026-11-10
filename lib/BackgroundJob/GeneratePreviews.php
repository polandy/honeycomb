<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\BackgroundJob;

use OCA\Honeycomb\Service\ImageService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\QueuedJob;
use OCP\IUserManager;

/** Warms the preview tiers of a chunk of one user's files, queued when a folder set is opened. */
final class GeneratePreviews extends QueuedJob {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it from the job list. */
	public function __construct(
		ITimeFactory $time,
		private IUserManager $userManager,
		private ImageService $images,
	) {
		parent::__construct($time);
	}

	/** @param mixed $argument `{userId: string, fileIds: list<int>}` as `ImageService::queueWarm` adds it */
	#[\Override]
	protected function run($argument): void {
		$userId = is_array($argument) ? $argument['userId'] ?? null : null;
		$fileIds = is_array($argument) ? $argument['fileIds'] ?? null : null;
		if (!is_string($userId) || !is_array($fileIds) || !array_is_list($fileIds) || array_filter($fileIds, is_int(...)) !== $fileIds) {
			throw new \InvalidArgumentException('Expected {userId: string, fileIds: list<int>} as the job argument');
		}
		/** @var list<int> $fileIds */
		$user = $this->userManager->get($userId);
		if ($user !== null) {
			$this->images->warm($user, $fileIds);
		}
	}
}
