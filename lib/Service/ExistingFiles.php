<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Tells which file ids still have a file, in the trash bin or not. */
interface ExistingFiles {
	/**
	 * The ids of `$fileIds` that still have a file cache row.
	 * @param list<int> $fileIds
	 * @return list<int>
	 * @throws \OCP\DB\Exception
	 */
	public function existing(array $fileIds): array;
}
