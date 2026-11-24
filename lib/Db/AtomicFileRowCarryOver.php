<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\FileRowCarryOver;
use OCA\Honeycomb\Service\FileRowStores;
use OCP\AppFramework\Db\TTransactional;
use OCP\IDBConnection;

/** Carries the rows of every `FileRowStore` over in one transaction (MOVE-002.10). */
final class AtomicFileRowCarryOver implements FileRowCarryOver {
	use TTransactional;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
		private FileRowStores $stores,
	) {
	}

	#[\Override]
	public function carryOver(int $fileId, int $newFileId): void {
		$this->atomic(function () use ($fileId, $newFileId): void {
			foreach ($this->stores->stores() as $store) {
				$store->carryOver($fileId, $newFileId);
			}
		}, $this->db);
	}
}
