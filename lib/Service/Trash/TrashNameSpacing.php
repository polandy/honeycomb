<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Trash;

use OCA\Honeycomb\Service\Support\Pause;
use OCP\AppFramework\Utility\ITimeFactory;

/** Keeps files of one name out of one trash bin second, since Nextcloud overwrites the earlier copy (ADR 0037). */
final class TrashNameSpacing {
	/** @var array<string, int> the last second each name may have been trashed in, this request */
	private array $lastSecond = [];

	public function __construct(
		private ITimeFactory $time,
		private Pause $pause,
	) {
	}

	/**
	 * True when no file of these names may have been trashed in the current second.
	 * @param list<string> $names
	 */
	public function clear(array $names): bool {
		$now = $this->time->getTime();
		foreach ($names as $name) {
			if (($this->lastSecond[$name] ?? PHP_INT_MIN) >= $now) {
				return false;
			}
		}
		return true;
	}

	/** Pauses until the clock is past the current second. */
	public function awaitNextSecond(): void {
		$this->pause->until($this->time->getTime() + 1);
	}

	/**
	 * Runs `$trash` for a file named `$name` once the name is clear, and keeps the name until the second after it.
	 * @template T
	 * @param callable(): T $trash
	 * @return T
	 */
	public function trash(string $name, callable $trash): mixed {
		while (!$this->clear([$name])) {
			$this->awaitNextSecond();
		}
		try {
			return $trash();
		} finally {
			$this->lastSecond[$name] = $this->time->getTime();
		}
	}
}
