<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The entries of one listing request; `truncated` when the entry limit cut it short; the user's permissions on each folder; the listed folder's file id. */
final class Listing implements \JsonSerializable {
	/**
	 * @param list<Entry> $entries
	 * @param list<array{path: string, permissions: int}> $folders
	 */
	public function __construct(
		private array $entries,
		private bool $truncated,
		private array $folders,
		private int $fileId,
	) {
	}

	/** @return array{entries: list<Entry>, truncated: bool, folders: list<array{path: string, permissions: int}>, fileId: int} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['entries' => $this->entries, 'truncated' => $this->truncated, 'folders' => $this->folders, 'fileId' => $this->fileId];
	}
}
