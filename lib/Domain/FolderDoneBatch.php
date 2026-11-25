<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** The folders one *Mark all done* marked, and those it skipped with the reason (FOLDERS-006.15). */
final readonly class FolderDoneBatch {
	/**
	 * @param list<FolderDone> $done
	 * @param array<int, DoneSkip> $skipped by folder file id
	 */
	public function __construct(
		public array $done,
		public array $skipped,
	) {
	}
}
