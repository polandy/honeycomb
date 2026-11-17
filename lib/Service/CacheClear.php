<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Clears what honeycomb remembers of the files it read: the XMP cache and the visual hashes (ADR 0032). */
final class CacheClear {
	public function __construct(
		private XmpCacheStore $xmpCache,
		private VisualHashStore $visualHashes,
	) {
	}

	/**
	 * Removes the cache rows of `$userId`, or of every user for null, and returns how many.
	 * @throws \OCP\DB\Exception
	 */
	public function clear(?string $userId): int {
		return $this->xmpCache->clear($userId) + $this->visualHashes->clear($userId);
	}
}
