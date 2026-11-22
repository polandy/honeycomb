<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** A file's preview lock in core's file locking, which frees it when the request ends (ADR 0050). */
final class CorePreviewLock implements PreviewLock {
	private const string KEY_PREFIX = 'honeycomb/preview/';
	/** How long a render waits for a held lock before it renders without it. */
	private const int WAIT_SECONDS = 30;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through its alias. */
	public function __construct(
		private ILockingProvider $locks,
		private ITimeFactory $time,
		private Pause $pause,
		private LoggerInterface $logger,
	) {
	}

	#[\Override]
	public function whileRendering(int $fileId, callable $render): mixed {
		$key = self::KEY_PREFIX . $fileId;
		if (!$this->acquire($key)) {
			$this->logger->warning('Rendering previews without the lock another request holds', ['fileId' => $fileId, 'waitedSeconds' => self::WAIT_SECONDS]);
			return $render();
		}
		try {
			return $render();
		} finally {
			$this->locks->releaseLock($key, ILockingProvider::LOCK_EXCLUSIVE);
		}
	}

	/** True once this request holds `$key`, false when another held it for the whole wait. */
	private function acquire(string $key): bool {
		$deadline = $this->time->getTime() + self::WAIT_SECONDS;
		while (true) {
			try {
				$this->locks->acquireLock($key, ILockingProvider::LOCK_EXCLUSIVE);
				return true;
			} catch (LockedException) {
				$now = $this->time->getTime();
				if ($now >= $deadline) {
					return false;
				}
				$this->pause->until($now + 1);
			}
		}
	}
}
