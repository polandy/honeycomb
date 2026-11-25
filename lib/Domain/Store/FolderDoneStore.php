<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain\Store;

use OCA\Honeycomb\Domain\FolderDone;

/** Where the done statuses of the folders are kept, one per folder (FOLDERS-005.10). */
interface FolderDoneStore extends FileRowStore, UserRowStore {
	/**
	 * The done statuses among `$fileIds`, by folder file id.
	 * @param list<int> $fileIds
	 * @return array<int, FolderDone>
	 */
	public function find(array $fileIds): array;

	/** Stores each folder's status in one transaction, replacing the one it had. */
	public function put(FolderDone ...$done): void;

	/** Removes each folder's status in one transaction; none is no error. */
	public function remove(int ...$fileIds): void;
}
