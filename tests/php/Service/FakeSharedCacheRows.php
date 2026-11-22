<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

/** The `SharedCacheRows` part of a fake store that keeps `$rows`. */
trait FakeSharedCacheRows {
	#[\Override]
	public function clearAll(): int {
		$removed = count($this->rows);
		$this->rows = [];
		return $removed;
	}
}
