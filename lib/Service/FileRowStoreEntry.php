<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A file row store with the name its log lines use and the key of its sweep cursor. */
final readonly class FileRowStoreEntry {
	public function __construct(
		public string $kind,
		public string $cursorKey,
		public FileRowStore $store,
	) {
	}
}
