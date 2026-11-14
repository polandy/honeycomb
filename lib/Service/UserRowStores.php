<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Every table of rows that go with a user. */
final readonly class UserRowStores {
	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private FileRowStores $fileRows,
		private PositionStore $positions,
	) {
	}

	/** @return list<UserRowStore> */
	public function all(): array {
		return [...$this->fileRows->stores(), $this->positions];
	}
}
