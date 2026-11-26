<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Where a user stopped in a connection, by asset and capture time, and how far the cull got, for Resume and Recent (IMMICH-003.14). */
final readonly class ImmichPosition implements \JsonSerializable {
	public function __construct(
		public string $connectionId,
		public string $assetId,
		public int $takenAt,
		public int $decided,
		public int $total,
		public int $updatedAt,
	) {
	}

	/** @return array{immich: string, assetId: string, takenAt: int, decided: int, total: int, updatedAt: int} */
	#[\Override]
	public function jsonSerialize(): array {
		return [
			'immich' => $this->connectionId,
			'assetId' => $this->assetId,
			'takenAt' => $this->takenAt,
			'decided' => $this->decided,
			'total' => $this->total,
			'updatedAt' => $this->updatedAt,
		];
	}
}
