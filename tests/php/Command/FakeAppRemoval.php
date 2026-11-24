<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Command;

use OCA\Honeycomb\Service\AppRemoval;

final class FakeAppRemoval implements AppRemoval {
	public ?\Throwable $failure = null;

	/** @param list<string> $tables */
	public function __construct(
		public array $tables,
	) {
	}

	#[\Override]
	public function tables(): array {
		if ($this->failure !== null) {
			throw $this->failure;
		}
		return $this->tables;
	}

	#[\Override]
	public function remove(): array {
		if ($this->failure !== null) {
			throw $this->failure;
		}
		$dropped = $this->tables;
		$this->tables = [];
		return $dropped;
	}
}
