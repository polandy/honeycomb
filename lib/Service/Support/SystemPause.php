<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Support;

use OCP\AppFramework\Utility\ITimeFactory;

/** Pauses the request until the server clock reaches a second. */
final class SystemPause implements Pause {
	private const MICROSECONDS_PER_SECOND = 1_000_000;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through its alias. */
	public function __construct(
		private ITimeFactory $time,
	) {
	}

	#[\Override]
	public function until(int $second): void {
		$wait = (float)$second - (float)$this->time->now()->format('U.u');
		if ($wait > 0) {
			/** @psalm-suppress ForbiddenCode The app's one sleep, injected everywhere as Pause. */
			usleep((int)ceil($wait * (float)self::MICROSECONDS_PER_SECOND));
		}
	}
}
