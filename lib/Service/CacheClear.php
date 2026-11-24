<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\Store\QualityStore;
use OCA\Honeycomb\Domain\Store\VisualHashStore;
use OCA\Honeycomb\Domain\Store\XmpCacheStore;

/** Clears what honeycomb remembers of the files it read: the XMP cache, and for every user the visual hashes and quality values (ADR 0032, ADR 0046). */
final class CacheClear {
	public function __construct(
		private XmpCacheStore $xmpCache,
		private VisualHashStore $visualHashes,
		private QualityStore $quality,
	) {
	}

	/**
	 * Removes the cache rows of `$userId`, which leaves the rows every user shares, or every cache row for null; returns how many.
	 * @throws \OCP\DB\Exception
	 */
	public function clear(?string $userId): int {
		$removed = $this->xmpCache->clear($userId);
		if ($userId === null) {
			$removed += $this->visualHashes->clearAll() + $this->quality->clearAll();
		}
		return $removed;
	}
}
