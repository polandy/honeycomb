<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Search;

use OCP\Files\Search\ISearchBinaryOperator;
use OCP\Files\Search\ISearchOperator;

/** `and`, `or` or `not` over file-cache conditions. */
final class BinaryOperator implements ISearchBinaryOperator, \Stringable {
	use QueryHints;

	/** @param list<BinaryOperator|Comparison> $arguments */
	public function __construct(
		private string $type,
		private array $arguments,
	) {
	}

	#[\Override]
	public function getType(): string {
		return $this->type;
	}

	/** @return list<ISearchOperator> */
	#[\Override]
	public function getArguments(): array {
		return $this->arguments;
	}

	/** The same form as Nextcloud's own operator; its query optimizer groups operators by it. */
	#[\Override]
	public function __toString(): string {
		if ($this->type === ISearchBinaryOperator::OPERATOR_NOT) {
			return '(not ' . $this->arguments[0]->__toString() . ')';
		}
		return '(' . implode(' ' . $this->type . ' ', $this->arguments) . ')';
	}
}
