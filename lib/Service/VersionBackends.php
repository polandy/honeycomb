<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Storage\IStorage;

/** Whether `files_versions` has a backend that keeps versions on a storage. */
interface VersionBackends {
	/** True when a versions backend serves `$storage`. */
	public function existFor(IStorage $storage): bool;
}
