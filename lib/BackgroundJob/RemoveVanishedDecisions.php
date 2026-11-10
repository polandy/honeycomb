<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\BackgroundJob;

use OCA\Honeycomb\Service\DecisionStore;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\IJob;
use OCP\BackgroundJob\TimedJob;
use Psr\Log\LoggerInterface;

/** Removes the decision rows of files deleted for good, once a day (ADR 0012). */
final class RemoveVanishedDecisions extends TimedJob {
	private const int DAY = 86_400;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it from the job list. */
	public function __construct(
		ITimeFactory $time,
		private DecisionStore $decisions,
		private LoggerInterface $logger,
	) {
		parent::__construct($time);
		$this->setInterval(self::DAY);
		$this->setTimeSensitivity(IJob::TIME_INSENSITIVE);
	}

	/** @param mixed $argument none, the job is registered by `info.xml` */
	#[\Override]
	protected function run($argument): void {
		$removed = $this->decisions->forgetVanishedFiles();
		if ($removed > 0) {
			$this->logger->info("Removed {$removed} decision rows of files deleted for good");
		}
	}
}
