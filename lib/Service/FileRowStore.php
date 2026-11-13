<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Rows each user keeps per file id, which follow a file and go with it or with the user. */
interface FileRowStore {
	/** Moves the user's row of `$fileId`, if there is one, to `$newFileId`. */
	public function carryOver(string $userId, int $fileId, int $newFileId): void;

	/** Removes the rows of every user whose file is deleted for good and returns how many. */
	public function forgetVanishedFiles(): int;

	/** Removes every row of the user. */
	public function forgetUser(string $userId): void;
}
