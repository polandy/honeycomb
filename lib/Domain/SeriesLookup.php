<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** The stored series and kept-out files among the asked file ids. */
final readonly class SeriesLookup implements \JsonSerializable {
	/**
	 * @param list<StoredSeries> $series in id order
	 * @param list<int> $keptOut in file id order
	 */
	public function __construct(
		public array $series,
		public array $keptOut,
	) {
	}

	/** @return array{series: list<StoredSeries>, keptOut: list<int>} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['series' => $this->series, 'keptOut' => $this->keptOut];
	}
}
