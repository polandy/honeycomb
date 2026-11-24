<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\Store\FlagStore;
use OCA\Honeycomb\Domain\Store\FolderDoneStore;
use OCA\Honeycomb\Domain\Store\PositionStore;
use OCA\Honeycomb\Domain\Store\SeriesStore;
use OCA\Honeycomb\Domain\Store\StatsStore;
use OCA\Honeycomb\Domain\Store\TagStore;
use OCA\Honeycomb\Domain\Store\UserRowStore;
use OCA\Honeycomb\Domain\Store\XmpCacheStore;
use OCA\Honeycomb\Immich\ImmichDecisionStore;

/** Every table of rows that go with a user, or name one; the shared rows stay (ADR 0040, *Who shares what*). */
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
		private FlagStore $flags,
	) {
	}

	/** @return list<UserRowStore> */
	public function all(): array {
		return [$this->series, $this->xmpCache, $this->tags, $this->positions, $this->stats, $this->immichDecisions, $this->folderDone, $this->flags];
	}
}
