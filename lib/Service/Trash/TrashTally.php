<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Trash;

use OCA\Honeycomb\Domain\PhotoFiles;
use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Service\Stats\StatsCount;
use OCP\Files\File;

/** Sums what one trash request deleted, for the statistics: whole pictures, files and bytes, or the RAWs of Remove RAWs (STATS-001). */
final class TrashTally {
	/** @var array<string, int> amounts by metric key */
	private array $amounts = [];

	/** @param bool $rawsOnly whether the request is Remove RAWs, which counts its RAWs only */
	public function __construct(
		private bool $rawsOnly,
	) {
	}

	/**
	 * Adds the files of one picture that were deleted, and the picture when all of them were.
	 * @param list<array{File, TrashResult}> $files each file with its result on success
	 * @param list<TrashResult> $results the result of each file
	 * @param list<int> $sizes the size of each file, read before the delete
	 */
	public function add(array $files, array $results, array $sizes): void {
		$deleted = false;
		$whole = true;
		foreach ($files as $index => [$file, $done]) {
			if ($results[$index] !== $done) {
				$whole = false;
			} elseif ($this->rawsOnly) {
				$this->addFile($file, StatsMetric::RawsRemoved, StatsMetric::RawsRemovedBytes, $sizes[$index]);
			} elseif ($done === TrashResult::Deleted) {
				$deleted = true;
				$this->addFile($file, StatsMetric::DeletedFiles, StatsMetric::DeletedBytes, $sizes[$index]);
			} else {
				$this->addFile($file, StatsMetric::TrashFiles, StatsMetric::TrashBytes, $sizes[$index]);
			}
		}
		if ($whole && !$this->rawsOnly) {
			$this->plus($deleted ? StatsMetric::DeletedPictures : StatsMetric::TrashPictures, 1);
		}
	}

	/**
	 * The sums, one per metric, in the order of the metrics.
	 * @return list<StatsCount>
	 */
	public function counts(): array {
		$counts = [];
		foreach (StatsMetric::cases() as $metric) {
			if (isset($this->amounts[$metric->value])) {
				$counts[] = new StatsCount($metric, $this->amounts[$metric->value]);
			}
		}
		return $counts;
	}

	private function addFile(File $file, StatsMetric $files, StatsMetric $bytes, int $size): void {
		if ($this->rawsOnly && PhotoFiles::isSidecar($file)) {
			return;
		}
		$this->plus($files, 1);
		$this->plus($bytes, $size);
	}

	private function plus(StatsMetric $metric, int $amount): void {
		$this->amounts[$metric->value] = ($this->amounts[$metric->value] ?? 0) + $amount;
	}
}
