<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\BackgroundJob;

use OCA\Honeycomb\Service\EmptySeriesSweep;
use OCA\Honeycomb\Service\FileRowStores;
use OCA\Honeycomb\Service\VanishedFileSweep;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\IJob;
use OCP\BackgroundJob\TimedJob;
use OCP\DB\Exception as DbException;
use Psr\Log\LoggerInterface;

/** Removes the flag, visual hash, series member and XMP cache rows of files deleted for good, then the series left empty, once a day (ADR 0024, ADR 0027, ADR 0040). */
final class RemoveVanishedDecisions extends TimedJob {
	private const int DAY = 86_400;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it from the job list. */
	public function __construct(
		ITimeFactory $time,
		private FileRowStores $stores,
		private VanishedFileSweep $sweep,
		private EmptySeriesSweep $emptySeries,
		private LoggerInterface $logger,
	) {
		parent::__construct($time);
		$this->setInterval(self::DAY);
		$this->setTimeSensitivity(IJob::TIME_INSENSITIVE);
	}

	/** @param mixed $argument none, the job is registered by `info.xml` */
	#[\Override]
	protected function run($argument): void {
		foreach ($this->stores->all() as $entry) {
			try {
				$removed = $this->sweep->sweep($entry->cursorKey, $entry->store);
			} catch (DbException $e) {
				$this->logger->error("Could not remove the {$entry->kind} rows of files deleted for good", ['exception' => $e]);
				continue;
			}
			if ($removed > 0) {
				$this->logger->info("Removed {$removed} {$entry->kind} rows of files deleted for good");
			}
		}
		$this->removeEmptySeries();
	}

	/** After the member rows, so a series that lost its last member goes in the same run. */
	private function removeEmptySeries(): void {
		try {
			$removed = $this->emptySeries->sweep();
		} catch (DbException $e) {
			$this->logger->error('Could not remove the series without members', ['exception' => $e]);
			return;
		}
		if ($removed > 0) {
			$this->logger->info("Removed {$removed} series without members");
		}
	}
}
