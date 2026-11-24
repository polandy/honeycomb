<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\LibraryFolder;
use OCA\Honeycomb\Domain\Store\LibraryFiles;
use OCP\Files\Folder;

/** A file cache in memory: the library folders below any root, their photo files and the decision rows per user. */
final class FakeLibraryFiles implements LibraryFiles {
	/** @var list<LibraryFolder> */
	public array $folders = [];
	/** @var list<array{fileId: int, parent: int, name: string, size: int, mtime: int}> */
	public array $photos = [];
	/** @var array<string, list<array{parent: int, name: string, flag: ?string, updatedAt: ?int, doneSeries: bool}>> */
	public array $decisions = [];
	/** @var list<list<int>> The folder ids of each `photoFiles()` call. */
	public array $photoCalls = [];

	#[\Override]
	public function folders(Folder $root): array {
		return $this->folders;
	}

	#[\Override]
	public function photoFiles(array $folderIds): array {
		$this->photoCalls[] = $folderIds;
		return array_values(array_filter($this->photos, static fn (array $photo): bool => in_array($photo['parent'], $folderIds, true)));
	}

	#[\Override]
	public function decisionRows(string $userId, array $folderIds): array {
		return array_values(array_filter($this->decisions[$userId] ?? [], static fn (array $row): bool => in_array($row['parent'], $folderIds, true)));
	}
}
