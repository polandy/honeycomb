<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowCarryOver;
use OCA\Honeycomb\Service\FileRowStores;

/** Carries the rows over store by store, without a transaction; the database tests prove the rollback. */
final readonly class FakeFileRowCarryOver implements FileRowCarryOver {
	public function __construct(
		private FileRowStores $stores,
	) {
	}

	#[\Override]
	public function carryOver(int $fileId, int $newFileId): void {
		foreach ($this->stores->stores() as $store) {
			$store->carryOver($fileId, $newFileId);
		}
	}
}
