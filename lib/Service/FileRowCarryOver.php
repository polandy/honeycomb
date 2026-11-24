<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Carries a moved file's rows over to its new file id. */
interface FileRowCarryOver {
	/**
	 * Moves every row of `$fileId` in every `FileRowStore`, every user's, to `$newFileId`, all or none.
	 * @throws \OCP\DB\Exception
	 */
	public function carryOver(int $fileId, int $newFileId): void;
}
