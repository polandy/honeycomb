<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Folder;

/** The folders of a library root, their photo files and the decisions on them, read from the file cache (FOLDERS-001). */
interface LibraryFiles {
	/**
	 * The root and every folder below it on its own storage, hidden ones left out, in path order.
	 * @return list<LibraryFolder>
	 */
	public function folders(Folder $root): array;

	/**
	 * The photo files, hidden ones left out, directly in the folders `$folderIds`.
	 * @param list<int> $folderIds
	 * @return list<array{fileId: int, parent: int, name: string, size: int, mtime: int}>
	 */
	public function photoFiles(array $folderIds): array;

	/**
	 * The files directly in `$folderIds` that carry a flag or belong to a done series of `$userId`.
	 * @param list<int> $folderIds
	 * @return list<array{parent: int, name: string, flag: ?string, updatedAt: ?int, doneSeries: bool}>
	 */
	public function decisionRows(string $userId, array $folderIds): array;
}
