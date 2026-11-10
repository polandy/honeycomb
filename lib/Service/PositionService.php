<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IUser;

/** Keeps each user's resume position per folder set, the most recent ones only (ADR 0012). */
final class PositionService {
	/** How many folder sets *Recent* lists. */
	public const int RECENT_LIMIT = 20;

	public function __construct(
		private PositionStore $store,
		private ITimeFactory $time,
	) {
	}

	/**
	 * The user's positions, the latest saved first.
	 * @return list<ResumePosition>
	 */
	public function recent(IUser $user): array {
		return $this->store->all($user->getUID());
	}

	/**
	 * Stores where the user stands in the folder set and forgets all but the most recent sets.
	 * @param array<array-key, mixed> $folderSet
	 * @throws InvalidPositionException for a malformed folder set, file id or count
	 */
	public function save(IUser $user, array $folderSet, int $fileId, int $decided, int $total): ResumePosition {
		if ($fileId < 1 || $decided < 0 || $decided > $total) {
			throw new InvalidPositionException('fileId must be positive and decided 0 to total');
		}
		$position = new ResumePosition(FolderSet::fromRequest($folderSet), $fileId, $decided, $total, $this->time->getTime());
		$this->store->save($user->getUID(), $position);
		$stale = array_slice($this->store->all($user->getUID()), self::RECENT_LIMIT);
		if ($stale !== []) {
			$this->store->forget($user->getUID(), array_map(static fn (ResumePosition $old): string => $old->folderSet->key(), $stale));
		}
		return $position;
	}
}
