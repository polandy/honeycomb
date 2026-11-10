<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The entries of one listing request; `truncated` when the entry limit cut it short. */
final class Listing implements \JsonSerializable {
	/** @param list<Entry> $entries */
	public function __construct(
		private array $entries,
		private bool $truncated,
	) {
	}

	/** @return array{entries: list<Entry>, truncated: bool} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['entries' => $this->entries, 'truncated' => $this->truncated];
	}
}
