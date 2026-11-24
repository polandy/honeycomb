<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Immich\ListingFilters;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\DataProviderExternal;
use PHPUnit\Framework\TestCase;

final class DecisionFilterTest extends TestCase {
	// spec: IMMICH-002.29
	/** @param array<string, mixed> $raw */
	#[DataProviderExternal(DecisionFilterVectors::class, 'cases')]
	public function testTheServerJudgesTheSharedVectorsAsTheGridDoes(array $raw, Flag $flag, int $rating, ?ColourLabel $colourLabel, bool $admits): void {
		$this->assertSame($admits, (new ListingFilters($raw))->decisions->admits($flag, $rating, $colourLabel));
	}

	public function testNoChoiceIsNoClause(): void {
		$this->assertSame([], (new ListingFilters([]))->decisions->clauses());
	}

	/** @return array<string, array{string, string}> */
	public static function ratingOps(): array {
		return ['at least' => ['atLeast', '>='], 'at most' => ['atMost', '<='], 'exactly' => ['exactly', '=']];
	}

	#[DataProvider('ratingOps')]
	public function testEachChosenGroupIsOneClauseOnItsColumn(string $op, string $operator): void {
		$filters = new ListingFilters(['flags' => ['picked', 'unflagged'], 'rating' => ['op' => $op, 'value' => 2], 'colourLabels' => ['red']]);

		$this->assertSame([
			['column' => 'flag', 'operator' => 'in', 'operand' => ['picked', 'unflagged']],
			['column' => 'rating', 'operator' => $operator, 'operand' => 2],
			['column' => 'colour_label', 'operator' => 'in', 'operand' => ['red']],
		], $filters->decisions->clauses());
	}
}
