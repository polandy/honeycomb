<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Move;

use OCP\Files\Folder;
use OCP\Files\Node;

/** Where the storage a node lies on is mounted in the user's files; a move keeps to one (MOVE-002.11). */
final class StorageRoot {
	/** The mount point as a path of the user's files, `/` for the user's own storage. */
	public static function of(Folder $userFolder, Node $node): string {
		return $userFolder->getRelativePath(rtrim($node->getMountPoint()->getMountPoint(), '/')) ?? '/';
	}
}
