<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IAppConfig;

/** Removes the rows of files deleted for good, a bounded number of chunks per run, going on where the last run stopped. */
final class VanishedFileSweep {
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
		return CursorWalk::walk(
			$this->config,
			$cursorKey,
			$store->fileIdsAfter(...),
			fn (array $fileIds): int => $this->removeVanished($store, $fileIds),
		);
	}

	/** @param array<int, int> $fileIds row id to file id */
	private function removeVanished(FileRowStore $store, array $fileIds): int {
		$existing = array_flip($this->files->existing(array_values(array_unique($fileIds))));
		$vanishedRows = array_keys(array_filter($fileIds, fn (int $fileId): bool => !isset($existing[$fileId])));
		return $vanishedRows === [] ? 0 : $store->deleteRows($vanishedRows);
	}
}
