<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** One file of a move request: the listed file, its new path and the file it may replace there. */
final readonly class MoveFile {
	public function __construct(
		public int $fileId,
		public string $etag,
		public string $path,
		public ?int $replaceFileId = null,
		public ?string $replaceEtag = null,
	) {
	}
}
