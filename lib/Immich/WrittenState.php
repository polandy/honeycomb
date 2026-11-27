<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Domain\Flag;

/** What honeycomb last wrote to Immich for an asset: the decision's flag and rating, and the rating Immich held after (IMMICH-004.21). */
final readonly class WrittenState {
	public function __construct(
		public Flag $flag,
		public int $rating,
		public ?int $immichRating,
	) {
	}
}
