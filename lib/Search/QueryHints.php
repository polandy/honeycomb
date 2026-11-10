<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Search;

/** The query hints every `ISearchOperator` keeps for Nextcloud's query optimizer. */
trait QueryHints {
	/** @var array<string, mixed> */
	private array $hints = [];

	/** @psalm-suppress PossiblyUnusedMethod Called by Nextcloud's search builder. */
	public function getQueryHint(string $name, mixed $default): mixed {
		return $this->hints[$name] ?? $default;
	}

	/** @psalm-suppress PossiblyUnusedMethod Called by Nextcloud's query optimizer. */
	public function setQueryHint(string $name, mixed $value): void {
		$this->hints[$name] = $value;
	}
}
