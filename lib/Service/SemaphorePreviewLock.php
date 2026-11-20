<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/**
 * A file's preview lock on a System V semaphore, shared by the server's PHP processes; without the `sysvsem` extension it
 * does not lock, as core's own preview limits do not.
 */
final class SemaphorePreviewLock implements PreviewLock {
	/** The first semaphore key, "HYC" in its high bytes so it stays clear of core's keys. */
	private const int FIRST_KEY = 0x48594300;
	/** Files share this many semaphores, so the server keeps few; two files on one wait for each other. */
	private const int SEMAPHORES = 256;

	#[\Override]
	public function whileRendering(int $fileId, callable $render): mixed {
		$semaphore = extension_loaded('sysvsem') ? sem_get(self::FIRST_KEY + $fileId % self::SEMAPHORES) : false;
		if ($semaphore === false || !sem_acquire($semaphore)) {
			return $render();
		}
		try {
			return $render();
		} finally {
			if (!sem_release($semaphore)) {
				throw new \RuntimeException("Could not release the preview lock of file $fileId");
			}
		}
	}
}
