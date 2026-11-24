<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Domain\Store\AppData;

final class FakeAppData implements AppData {
	public ?\Throwable $failure = null;

	/** @param array<string, int> $rows */
	public function __construct(
		public array $rows,
	) {
	}

	#[\Override]
	public function count(): array {
		if ($this->failure !== null) {
			throw $this->failure;
		}
		return $this->rows;
	}

	#[\Override]
	public function empty(): array {
		if ($this->failure !== null) {
			throw $this->failure;
		}
		$removed = $this->rows;
		$this->rows = array_map(static fn (int $_rows): int => 0, $removed);
		return $removed;
	}
}
