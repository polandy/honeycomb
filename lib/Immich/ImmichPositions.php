<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IUser;

/** Keeps each user's resume position per connection, outside the folder sets' limit and without active time (IMMICH-003.23). */
final class ImmichPositions {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichPositionStore $store,
		private Connections $connections,
		private ITimeFactory $time,
	) {
	}

	/**
	 * The user's positions, the latest saved first.
	 * @return list<ImmichPosition>
	 */
	public function recent(IUser $user): array {
		return $this->store->all($user->getUID());
	}

	/** Stores where the user stands in their connection; a malformed position is a bad request, another user's connection unknown (IMMICH-003.24). */
	public function save(IUser $user, string $connectionId, string $assetId, int $takenAt, int $decided, int $total): ImmichPosition {
		if (preg_match(AssetDecision::ASSET_ID, $assetId) !== 1 || $takenAt < 0 || $decided < 0 || $decided > $total) {
			throw new ImmichException(ImmichError::Request);
		}
		$connection = $this->connections->find($user->getUID(), $connectionId);
		$position = new ImmichPosition($connection->id, $assetId, $takenAt, $decided, $total, $this->time->getTime());
		$this->store->save($user->getUID(), $position);
		return $position;
	}
}
