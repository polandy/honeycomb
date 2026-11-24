<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\Store\ExistingFiles;
use OCA\Honeycomb\Domain\Store\FlagStore;

/** Removes the flags of files deleted for good or lying in a trash bin, which are throw-away data (ADR 0040). */
final class OrphanedFlags {
	/** Rows per chunk; also Oracle's limit of an `IN` list. */
	private const int CHUNK = 1_000;

	public function __construct(
		private FlagStore $store,
		private ExistingFiles $files,
	) {
	}

	/**
	 * Walks the whole flags table once and returns how many rows it removed.
	 * @throws \OCP\DB\Exception
	 */
	public function remove(): int {
		$removed = 0;
		$afterId = 0;
		do {
			$rows = $this->store->fileIdsAfter($afterId, self::CHUNK);
			if ($rows === []) {
				break;
			}
			$kept = array_flip($this->files->outsideTrashBin(array_values($rows)));
			$orphans = array_keys(array_filter($rows, static fn (int $fileId): bool => !isset($kept[$fileId])));
			$removed += $orphans === [] ? 0 : $this->store->deleteRows($orphans);
			$afterId = array_key_last($rows);
		} while (count($rows) === self::CHUNK);
		return $removed;
	}
}
