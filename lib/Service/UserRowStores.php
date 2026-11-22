<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Immich\ImmichDecisionStore;

/** Every table of rows that go with a user; the flags, visual hashes and quality values are no one's and stay (ADR 0040, ADR 0046); a done status goes with its user (ADR 0049). */
final readonly class UserRowStores {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private SeriesStore $series,
		private XmpCacheStore $xmpCache,
		private TagStore $tags,
		private PositionStore $positions,
		private StatsStore $stats,
		private ImmichDecisionStore $immichDecisions,
		private FolderDoneStore $folderDone,
	) {
	}

	/** @return list<UserRowStore> */
	public function all(): array {
		return [$this->series, $this->xmpCache, $this->tags, $this->positions, $this->stats, $this->immichDecisions, $this->folderDone];
	}
}
