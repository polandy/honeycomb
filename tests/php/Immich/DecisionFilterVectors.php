<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;

/** The decision filter vectors the grid's filter shares (IMMICH-002.29). */
final class DecisionFilterVectors {
	private const string FILE = __DIR__ . '/../../fixtures/decision-filter/vectors.json';

	/**
	 * @return array<string, array{array<string, mixed>, Flag, int, ?ColourLabel, bool}> request filters, flag, rating, colour label, admits
	 * @psalm-suppress PossiblyUnusedMethod PHPUnit calls the data provider.
	 */
	public static function cases(): array {
		/** @psalm-suppress ForbiddenCode Reads a test fixture, not a user file. */
		$json = (string)file_get_contents(self::FILE);
		/** @var array{cases: list<array{name: string, filters: array<string, mixed>, decision: array{flag: string, rating: int, colourLabel: ?string}, admits: bool}>} $vectors */
		$vectors = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
		$cases = [];
		foreach ($vectors['cases'] as $case) {
			$label = $case['decision']['colourLabel'];
			$cases[$case['name']] = [$case['filters'], Flag::from($case['decision']['flag']), $case['decision']['rating'], $label === null ? null : ColourLabel::from($label), $case['admits']];
		}
		return $cases;
	}
}
