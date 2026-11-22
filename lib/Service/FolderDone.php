<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** That a user marked a folder done, when, and how many photos it had then (FOLDERS-005.10). */
final readonly class FolderDone {
	public function __construct(
		public int $fileId,
		public string $userId,
		public int $doneAt,
		public int $photos,
	) {
	}
}
