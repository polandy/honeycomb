<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;

/**
 * The flag, rating and colour label filters as clauses on the decision's columns; the check and the query read the same clauses (IMMICH-002.29).
 * @psalm-type Clause = array{column: string, operator: string, operand: int|list<string>}
 */
final class DecisionFilter {
	public const string IN = 'in';
	/** The comparison each rating op of a request stands for. */
	public const array RATING_OPERATORS = ['atLeast' => '>=', 'atMost' => '<=', 'exactly' => '='];

	/** @var list<Clause> */
	private readonly array $clauses;

	/**
	 * @param list<Flag> $flags
	 * @param ?array{op: string, value: int} $rating
	 * @param list<ColourLabel> $colourLabels
	 */
	public function __construct(array $flags, ?array $rating, array $colourLabels) {
		$clauses = [];
		if ($flags !== []) {
			$clauses[] = ['column' => 'flag', 'operator' => self::IN, 'operand' => array_map(static fn (Flag $flag): string => $flag->value, $flags)];
		}
		if ($rating !== null) {
			$clauses[] = ['column' => 'rating', 'operator' => self::RATING_OPERATORS[$rating['op']], 'operand' => $rating['value']];
		}
		if ($colourLabels !== []) {
			$clauses[] = ['column' => 'colour_label', 'operator' => self::IN, 'operand' => array_map(static fn (ColourLabel $label): string => $label->value, $colourLabels)];
		}
		$this->clauses = $clauses;
	}

	/**
	 * Each chosen group as one clause; a decision passes when it passes all of them.
	 * @return list<Clause>
	 */
	public function clauses(): array {
		return $this->clauses;
	}

	/** Whether a picture of this decision passes every clause. */
	public function admits(Flag $flag, int $rating, ?ColourLabel $colourLabel): bool {
		$columns = ['flag' => $flag->value, 'rating' => $rating, 'colour_label' => $colourLabel?->value];
		foreach ($this->clauses as $clause) {
			if (!self::holds($columns[$clause['column']] ?? null, $clause['operator'], $clause['operand'])) {
				return false;
			}
		}
		return true;
	}

	/** @param int|list<string> $operand */
	private static function holds(int|string|null $value, string $operator, int|array $operand): bool {
		if (is_array($operand)) {
			return in_array($value, $operand, true);
		}
		return match ($operator) {
			self::RATING_OPERATORS['atLeast'] => $value >= $operand,
			self::RATING_OPERATORS['atMost'] => $value <= $operand,
			default => $value === $operand,
		};
	}
}
