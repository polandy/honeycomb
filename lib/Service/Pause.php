<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Waits for the clock, injected so that tests never sleep. */
interface Pause {
	/** Returns once the clock reads at least `$second` (Unix time). */
	public function until(int $second): void;
}
