<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IUser;

/** Writes the one flag of each file the user reaches (ADR 0040). */
final class FlagService {
	/** The counts a flag item may carry (STATS-001.36). */
	private const array COUNTS = [StatsMetric::PicturesDecided, StatsMetric::PicturesPicked, StatsMetric::PicturesRejected];

	public function __construct(
		private FlagStore $store,
		private UserPhotos $photos,
		private ITimeFactory $time,
		private StatsService $stats,
	) {
	}

	/**
	 * Writes the whole states in `$items` of the photos in folders the user may write to, and counts what the saved items carry.
	 * @param array<array-key, mixed> $items
	 * @throws InvalidRequestException for a malformed item or a file id given twice, before any write
	 * @throws \OCP\DB\Exception
	 */
	public function save(IUser $user, array $items): FlagAnswer {
		$flags = $this->parse($user, $items);
		$counts = self::counts($items);
		$rateable = $this->photos->rateable($user, array_keys($flags));
		$allowed = array_values(array_filter($flags, static fn (FileFlag $flag): bool => $rateable[$flag->fileId] ?? false));
		if ($allowed !== []) {
			RetryOnConflict::run(fn () => $this->store->save($allowed));
		}
		$saved = array_map(static fn (FileFlag $flag): int => $flag->fileId, $allowed);
		$this->stats->count($user, ...array_merge(...array_map(static fn (int $fileId): array => $counts[$fileId], $saved)));
		return self::answer(array_keys($flags), $saved, static fn (int $fileId): string => isset($rateable[$fileId]) ? FlagAnswer::NOT_PERMITTED : FlagAnswer::NOT_FOUND);
	}

	/**
	 * Inserts the flags in `$items` of the photos the user reaches that have no row yet, so a reader may take a picture's XMP over.
	 * @param array<array-key, mixed> $items
	 * @throws InvalidRequestException for a malformed item or a file id given twice, before any write
	 * @throws \OCP\DB\Exception
	 */
	public function takeOver(IUser $user, array $items): FlagAnswer {
		$flags = $this->parse($user, $items);
		$reached = array_flip($this->photos->photos($user, array_keys($flags)));
		$candidates = array_values(array_intersect_key($flags, $reached));
		$inserted = $candidates === [] ? [] : RetryOnConflict::run(fn (): array => $this->store->takeOver($candidates));
		return self::answer(array_keys($flags), $inserted, static fn (int $fileId): string => isset($reached[$fileId]) ? FlagAnswer::EXISTS : FlagAnswer::NOT_FOUND);
	}

	/**
	 * Records the sidecar ETags in `$items` on the rows of the photos in folders the user may write to (ADR 0056).
	 * @param array<array-key, mixed> $items
	 * @throws InvalidRequestException for a malformed item or a file id given twice, before any write
	 * @throws \OCP\DB\Exception
	 */
	public function sidecarEtags(IUser $user, array $items): FlagAnswer {
		$parsed = array_map(SidecarEtag::fromRequest(...), FileIds::items($items, ListingService::ENTRY_LIMIT));
		$fileIds = FileIds::eachOnce(array_map(static fn (SidecarEtag $etag): int => $etag->fileId, $parsed));
		$etags = array_combine($fileIds, array_map(static fn (SidecarEtag $etag): ?string => $etag->sidecarEtag, $parsed));
		$rateable = $this->photos->rateable($user, $fileIds);
		$allowed = array_filter($etags, static fn (int $fileId): bool => $rateable[$fileId] ?? false, ARRAY_FILTER_USE_KEY);
		$set = $allowed === [] ? [] : RetryOnConflict::run(fn (): array => $this->store->setSidecarEtags($allowed));
		return self::answer($fileIds, $set, static fn (int $fileId): string => match ($rateable[$fileId] ?? null) {
			true => FlagAnswer::MISSING,
			false => FlagAnswer::NOT_PERMITTED,
			null => FlagAnswer::NOT_FOUND,
		});
	}

	/**
	 * The request's flags by file id, in its order, stamped now by the user.
	 * @param array<array-key, mixed> $items
	 * @return array<int, FileFlag>
	 */
	private function parse(IUser $user, array $items): array {
		$now = $this->time->getTime();
		$uid = $user->getUID();
		$flags = array_map(static fn (mixed $item): FileFlag => FileFlag::fromRequest($item, $now, $uid), FileIds::items($items, ListingService::ENTRY_LIMIT));
		$fileIds = FileIds::eachOnce(array_map(static fn (FileFlag $flag): int => $flag->fileId, $flags));
		return array_combine($fileIds, $flags);
	}

	/**
	 * The counts each item carries, by file id; the items are already parsed as flags.
	 * @param array<array-key, mixed> $items
	 * @return array<int, list<StatsCount>>
	 */
	private static function counts(array $items): array {
		$counts = [];
		/** @var array{fileId: int, counts?: mixed} $item */
		foreach ($items as $item) {
			$counts[$item['fileId']] = StatsItemCounts::parse($item['counts'] ?? null, self::COUNTS);
		}
		return $counts;
	}

	/**
	 * @param list<int> $fileIds
	 * @param list<int> $saved
	 * @param \Closure(int): string $reason why a file id not saved was skipped
	 */
	private static function answer(array $fileIds, array $saved, \Closure $reason): FlagAnswer {
		$skipped = array_values(array_diff($fileIds, $saved));
		return new FlagAnswer($saved, array_map(static fn (int $fileId): array => ['fileId' => $fileId, 'reason' => $reason($fileId)], $skipped));
	}
}
