<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Removes the decision rows of connections the connections file no longer names for their user (IMMICH-003.10). */
final class ImmichConnectionSweep {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private Connections $connections,
		private ImmichDecisionStore $store,
	) {
	}

	/** The number of rows removed; a file not configured, missing or invalid sweeps nothing (IMMICH-003.11). */
	public function sweep(): int {
		try {
			$connections = $this->connections->all();
		} catch (ImmichException) {
			// Connections has logged a broken file; without a valid file no row is known to be gone.
			return 0;
		}
		return $this->store->keepOnly(array_map(static fn (Connection $connection): array => [$connection->id, $connection->user], $connections));
	}
}
