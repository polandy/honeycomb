<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Image;

use OCA\Honeycomb\Service\Support\Pause;
use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** A file's preview lock in core's file locking, which frees it when the request ends (ADR 0050). */
final class CorePreviewLock implements PreviewLock {
	private const string KEY_PREFIX = 'honeycomb/preview/';
	/** How long a render waits for a held lock before it renders without it. */
	private const int WAIT_SECONDS = 30;
	/** The pause between two tries at a held lock, short as the warm-up holds a tile's file often (ADR 0050). */
	private const int RETRY_MILLISECONDS = 50;
	/** The tries after the first that make up the wait. */
	private const int RETRIES = self::WAIT_SECONDS * 1_000 / self::RETRY_MILLISECONDS;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through its alias. */
	public function __construct(
		private ILockingProvider $locks,
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
		for ($retry = 0; ; $retry++) {
			try {
				$this->locks->acquireLock($key, ILockingProvider::LOCK_EXCLUSIVE);
				return true;
			} catch (LockedException) {
				if ($retry >= self::RETRIES) {
					return false;
				}
				$this->pause->forMilliseconds(self::RETRY_MILLISECONDS);
			}
		}
	}
}
