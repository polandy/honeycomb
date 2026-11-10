<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Search;

use OCP\Files\Search\ISearchComparison;

/** One file-cache condition; `OCP` has no public implementation of `ISearchComparison`. */
final class Comparison implements ISearchComparison, \Stringable {
	use QueryHints;

	public function __construct(
		private string $type,
		private string $field,
		private string|int $value,
	) {
	}

	#[\Override]
	public function getType(): string {
		return $this->type;
	}

	#[\Override]
	public function getField(): string {
		return $this->field;
	}

	#[\Override]
	public function getExtra(): string {
		return '';
	}

	#[\Override]
	public function getValue(): string|int {
		return $this->value;
	}

	/** The same form as Nextcloud's own comparison; its query optimizer groups operators by it. */
	#[\Override]
	public function __toString(): string {
		return $this->field . ' ' . $this->type . ' ' . json_encode($this->value, JSON_THROW_ON_ERROR);
	}
}
