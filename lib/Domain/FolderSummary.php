<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** What a scan found in one folder's own photo files, at the folder etag it read (FOLDERS-005). */
final readonly class FolderSummary {
	public function __construct(
		public int $fileId,
		public string $etag,
		public int $photos,
		public int $bytes,
		public int $rawBytes,
		public int $bursts,
		public ?int $oldest,
		public ?int $newest,
		public ?int $lastActivity,
		public int $scannedAt,
	) {
	}
}
