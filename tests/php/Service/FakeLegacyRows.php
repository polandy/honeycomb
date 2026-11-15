<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

/** The `LegacyRowStore` reads and removals of a fake store whose rows are `$rows[$userId][$fileId]`. */
trait FakeLegacyRows {
	/** @return list<int> */
	#[\Override]
	public function fileIdsOf(string $userId): array {
		$fileIds = array_keys($this->rows[$userId] ?? []);
		sort($fileIds);
		return $fileIds;
	}

	#[\Override]
	public function forget(string $userId, array $fileIds): void {
		$this->rows[$userId] = array_diff_key($this->rows[$userId] ?? [], array_flip($fileIds));
	}
}
