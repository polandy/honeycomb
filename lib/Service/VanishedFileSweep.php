<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\IAppConfig;

/** Removes the rows of files deleted for good, a bounded number of chunks per run, going on where the last run stopped. */
final class VanishedFileSweep {
	/** Rows per chunk; also Oracle's limit of an `IN` list. */
	private const int CHUNK = 1_000;

	private const int CHUNKS_PER_RUN = 100;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it for the background job. */
	public function __construct(
		private ExistingFiles $files,
		private IAppConfig $config,
	) {
	}

	/**
	 * Walks `$store` by row id from the cursor kept under `$cursorKey` and returns how many rows it removed.
	 * @throws \OCP\DB\Exception after keeping the cursor of the last finished chunk
	 */
	public function sweep(string $cursorKey, FileRowStore $store): int {
		$afterId = $this->config->getValueInt(Application::APP_ID, $cursorKey, lazy: true);
		$removed = 0;
		try {
			for ($chunk = 0; $chunk < self::CHUNKS_PER_RUN; ++$chunk) {
				$fileIds = $store->fileIdsAfter($afterId, self::CHUNK);
				$removed += $this->removeVanished($store, $fileIds);
				if (count($fileIds) < self::CHUNK) {
					// The end of the table: the next run starts again from the first row.
					$afterId = 0;
					break;
				}
				$afterId = (int)array_key_last($fileIds);
			}
		} finally {
			$this->config->setValueInt(Application::APP_ID, $cursorKey, $afterId, lazy: true);
		}
		return $removed;
	}

	/** @param array<int, int> $fileIds row id to file id */
	private function removeVanished(FileRowStore $store, array $fileIds): int {
		if ($fileIds === []) {
			return 0;
		}
		$existing = array_flip($this->files->existing(array_values(array_unique($fileIds))));
		$vanishedRows = array_keys(array_filter($fileIds, fn (int $fileId): bool => !isset($existing[$fileId])));
		return $vanishedRows === [] ? 0 : $store->deleteRows($vanishedRows);
	}
}
