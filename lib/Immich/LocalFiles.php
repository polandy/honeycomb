<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Reads a file outside Nextcloud's storage: the connections file and the key files only (ADR 0042). */
interface LocalFiles {
	/** The file's content, or null when it is missing or cannot be read. */
	public function read(string $path): ?string;
}
