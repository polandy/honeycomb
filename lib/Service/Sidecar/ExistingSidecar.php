<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Sidecar;

use OCA\Honeycomb\Service\Stats\StatsCount;

/** A sidecar to save over, with the ETag and size the client read (ADR 0017). */
final readonly class ExistingSidecar {
	/**
	 * @param positive-int $fileId
	 * @param non-empty-string $etag
	 * @param int<0, max> $size
	 * @param list<StatsCount> $counts what the browser counts once the save succeeds (STATS-001.36)
	 * @param bool $foreign whether it holds data of digiKam or darktable (STATS-001.38)
	 */
	public function __construct(
		public int $fileId,
		public string $etag,
		public int $size,
		public string $bytes,
		public array $counts = [],
		public bool $foreign = false,
	) {
	}
}
