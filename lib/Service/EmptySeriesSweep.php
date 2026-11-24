<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\Store\SeriesStore;
use OCP\IAppConfig;

/** Removes the series left without a member row, a bounded number of chunks per run (ADR 0027). */
final class EmptySeriesSweep {
	private const string CURSOR_KEY = 'empty_series_after';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it for the background job. */
	public function __construct(
		private SeriesStore $store,
		private IAppConfig $config,
	) {
	}

	/**
	 * Walks the series from the stored cursor and returns how many it removed.
	 * @throws \OCP\DB\Exception after keeping the cursor of the last finished chunk
	 */
	public function sweep(): int {
		return CursorWalk::walk(
			$this->config,
			self::CURSOR_KEY,
			function (int $afterId, int $limit): array {
				$ids = $this->store->seriesIdsAfter($afterId, $limit);
				return array_combine($ids, $ids);
			},
			fn (array $ids): int => $this->store->deleteEmptySeries(array_keys($ids)),
		);
	}
}
