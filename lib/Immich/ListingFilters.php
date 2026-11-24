<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;

/** The checked filters of one Immich listing request; anything malformed is a bad request (IMMICH-002.5). */
final class ListingFilters {
	public const int MAX_DEVICES = 20;
	private const array KEYS = ['takenAfter', 'takenBefore', 'devices', 'kinds', 'flags', 'rating', 'colourLabels'];
	private const int MAX_RATING = 5;

	public readonly ?int $takenAfter;
	public readonly ?int $takenBefore;
	/** @var list<?string> camera models; null is a picture without one */
	public readonly array $devices;
	/** @var list<AssetKind> */
	public readonly array $kinds;
	public readonly DecisionFilter $decisions;
	/** @var list<Flag> */
	private readonly array $flags;
	/** @var ?array{op: string, value: int} */
	private readonly ?array $rating;
	/** @var list<ColourLabel> */
	private readonly array $colourLabels;

	/** @param array<array-key, mixed> $raw the request's `filters` */
	public function __construct(
		private array $raw,
	) {
		if (array_diff(array_keys($raw), self::KEYS) !== []) {
			throw self::malformed();
		}
		$this->takenAfter = self::time($raw['takenAfter'] ?? null);
		$this->takenBefore = self::time($raw['takenBefore'] ?? null);
		$this->devices = self::devices($raw['devices'] ?? []);
		$this->kinds = array_map(static fn (string $kind): AssetKind => AssetKind::tryFrom($kind) ?? throw self::malformed(), self::strings($raw['kinds'] ?? []));
		$this->flags = array_map(static fn (string $flag): Flag => Flag::tryFrom($flag) ?? throw self::malformed(), self::strings($raw['flags'] ?? []));
		$this->rating = self::rating($raw['rating'] ?? null);
		$this->colourLabels = array_map(static fn (string $label): ColourLabel => ColourLabel::tryFrom($label) ?? throw self::malformed(), self::strings($raw['colourLabels'] ?? []));
		$this->decisions = new DecisionFilter($this->flags, $this->rating, $this->colourLabels);
	}

	/**
	 * The same filters with some groups replaced, as a facet counts under the other groups (IMMICH-002.14).
	 * @param array<string, mixed> $override
	 */
	public function with(array $override): self {
		return new self([...$this->raw, ...$override]);
	}

	/** Whether a picture of this decision passes the flag, rating and colour label filters. */
	public function admits(Flag $flag, int $rating, ?ColourLabel $colourLabel): bool {
		return $this->decisions->admits($flag, $rating, $colourLabel);
	}

	/** Whether a picture without a decision passes the decision filters. */
	public function admitsUndecided(): bool {
		return $this->admits(Flag::Unflagged, 0, null);
	}

	/** Equal for the same choices in any order or repetition; a cursor is bound to it. */
	public function fingerprint(): string {
		$sorted = static function (array $values): array {
			$values = array_values(array_unique($values, SORT_REGULAR));
			usort($values, static fn (mixed $a, mixed $b): int => $a <=> $b);
			return $values;
		};
		return hash('sha256', json_encode([
			$this->takenAfter,
			$this->takenBefore,
			$sorted($this->devices),
			$sorted(array_map(static fn (AssetKind $kind): string => $kind->value, $this->kinds)),
			$sorted(array_map(static fn (Flag $flag): string => $flag->value, $this->flags)),
			$this->rating,
			$sorted(array_map(static fn (ColourLabel $label): string => $label->value, $this->colourLabels)),
		], JSON_THROW_ON_ERROR));
	}

	private static function time(mixed $value): ?int {
		if ($value !== null && (!is_int($value) || $value < 0)) {
			throw self::malformed();
		}
		return $value;
	}

	/** @return list<?string> */
	private static function devices(mixed $value): array {
		if (!is_array($value) || !array_is_list($value) || count($value) > self::MAX_DEVICES) {
			throw self::malformed();
		}
		foreach ($value as $device) {
			if ($device !== null && (!is_string($device) || $device === '')) {
				throw self::malformed();
			}
		}
		/** @var list<?string> $value */
		return $value;
	}

	/** @return list<string> */
	private static function strings(mixed $value): array {
		if (!is_array($value) || !array_is_list($value)) {
			throw self::malformed();
		}
		foreach ($value as $item) {
			if (!is_string($item)) {
				throw self::malformed();
			}
		}
		/** @var list<string> $value */
		return $value;
	}

	/** @return ?array{op: string, value: int} */
	private static function rating(mixed $value): ?array {
		if ($value === null) {
			return null;
		}
		if (!is_array($value) || count($value) !== 2) {
			throw self::malformed();
		}
		/** @var mixed $op */
		$op = $value['op'] ?? null;
		/** @var mixed $stars */
		$stars = $value['value'] ?? null;
		if (!is_string($op) || !array_key_exists($op, DecisionFilter::RATING_OPERATORS) || !is_int($stars) || $stars < 0 || $stars > self::MAX_RATING) {
			throw self::malformed();
		}
		return ['op' => $op, 'value' => $stars];
	}

	private static function malformed(): ImmichException {
		return new ImmichException(ImmichError::Request);
	}
}
