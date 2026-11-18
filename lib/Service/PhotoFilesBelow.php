<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Folder;

/** Counts the photo files below a folder from Nextcloud's file cache, without a walk (ADR 0011). */
interface PhotoFilesBelow {
	/**
	 * The photo files in `$folder` and in every folder below it, hidden ones left out, and whether
	 * the file cache may have missed some; null when it does not know the folder.
	 * @throws \OCP\DB\Exception when the database fails
	 */
	public function count(Folder $folder): ?PhotoCount;
}
