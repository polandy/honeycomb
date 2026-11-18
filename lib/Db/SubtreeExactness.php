<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCP\Files\Storage\IStorage;

/** Tells when a file cache count of a subtree may miss files (ADR 0011). */
final class SubtreeExactness {
	/** The wrapper Team folders put around a folder with advanced permissions; named, not imported, as the app may be absent. */
	public const ACL_STORAGE = 'OCA\\GroupFolders\\ACL\\ACLStorageWrapper';

	/** Whether the count of the subtree at `$size` on `$storage` (null when unknown) may miss files. */
	public static function mayMissFiles(int $size, ?IStorage $storage): bool {
		/** @psalm-suppress ArgumentTypeCoercion the class may be absent, so it cannot be a typed constant */
		return $size < 0 || $storage === null || $storage->instanceOfStorage(self::ACL_STORAGE);
	}

	/** Whether a mount whose root has this file id is not scanned yet. */
	public static function unscannedMount(int $rootId): bool {
		return $rootId <= 0;
	}
}
