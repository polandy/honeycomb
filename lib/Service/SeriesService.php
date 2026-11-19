<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** Reads and writes the user's stored series, only on the user's photos (ADR 0027), and counts the series done (STATS-001.29). */
final class SeriesService {
	public function __construct(
		private SeriesStore $store,
		private UserPhotos $photos,
		private StatsService $stats,
	) {
	}

	/**
	 * The user's series with members among `$fileIds`, and the kept-out files among them.
	 * @param array<array-key, mixed> $fileIds
	 * @throws InvalidSeriesException for anything but a list of positive file ids within the limit
	 */
	public function lookup(IUser $user, array $fileIds): SeriesLookup {
		return $this->store->find($user->getUID(), FileIds::parse($fileIds, ListingService::ENTRY_LIMIT, InvalidSeriesException::class));
	}

	/**
	 * Writes the whole state of the body, skipping file ids that are not the user's photos.
	 * @param array<array-key, mixed> $series
	 * @param array<array-key, mixed> $keptOut
	 * @param array<array-key, mixed> $released
	 * @return array{ids: list<int>, saved: list<int>} each series item's id and the file ids written
	 * @throws InvalidSeriesException for a malformed body, with nothing written
	 */
	public function save(IUser $user, array $series, array $keptOut, array $released): array {
		$write = SeriesWrite::fromRequest($series, $keptOut, $released);
		$saved = $this->photos->photos($user, $write->fileIds());
		$written = ['ids' => [], 'done' => 0];
		RetryOnConflict::run(function () use ($user, $write, $saved, &$written): void {
			$written = $this->store->write($user->getUID(), $write->only($saved));
		});
		$this->stats->count($user, new StatsCount(StatsMetric::SeriesDone, $written['done']));
		return ['ids' => $written['ids'], 'saved' => $saved];
	}
}
