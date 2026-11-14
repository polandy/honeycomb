<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\BackgroundJob;

use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\TagStore;
use OCA\Honeycomb\Service\VanishedFileSweep;
use OCA\Honeycomb\Service\VisualHashStore;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\IJob;
use OCP\BackgroundJob\TimedJob;
use OCP\DB\Exception as DbException;
use Psr\Log\LoggerInterface;

/** Removes the decision, tag and visual hash rows of files deleted for good, once a day (ADR 0012, ADR 0022, ADR 0024). */
final class RemoveVanishedDecisions extends TimedJob {
	private const int DAY = 86_400;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it from the job list. */
	public function __construct(
		ITimeFactory $time,
		private DecisionStore $decisions,
		private TagStore $tags,
		private VisualHashStore $visualHashes,
		private VanishedFileSweep $sweep,
		private LoggerInterface $logger,
	) {
		parent::__construct($time);
		$this->setInterval(self::DAY);
		$this->setTimeSensitivity(IJob::TIME_INSENSITIVE);
	}

	/** @param mixed $argument none, the job is registered by `info.xml` */
	#[\Override]
	protected function run($argument): void {
		$stores = [
			'decision' => ['vanished_after_decisions', $this->decisions],
			'tag' => ['vanished_after_file_tags', $this->tags],
			'visual hash' => ['vanished_after_hashes', $this->visualHashes],
		];
		foreach ($stores as $kind => [$cursorKey, $store]) {
			try {
				$removed = $this->sweep->sweep($cursorKey, $store);
			} catch (DbException $e) {
				$this->logger->error("Could not remove the {$kind} rows of files deleted for good", ['exception' => $e]);
				continue;
			}
			if ($removed > 0) {
				$this->logger->info("Removed {$removed} {$kind} rows of files deleted for good");
			}
		}
	}
}
