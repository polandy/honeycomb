<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;

/** The checked filters of one Immich listing request; anything malformed is a bad request (IMMICH-002.5). */
final class ListingFilters {
	public const int MAX_DEVICES = 20;
	private const array KEYS = ['takenAfter', 'takenBefore', 'devices', 'kinds', 'flags', 'rating', 'colourLabels'];
	private const array RATING_OPS = ['atLeast', 'atMost', 'exactly'];
	private const int MAX_RATING = 5;

	public readonly ?int $takenAfter;
	public readonly ?int $takenBefore;
	/** @var list<?string> camera models; null is a picture without one */
	public readonly array $devices;
	/** @var list<AssetKind> */
	public readonly array $kinds;
	/** @var list<Flag> */
	public readonly array $flags;
	/** @var ?array{op: string, value: int} */
	public readonly ?array $rating;
	/** @var list<ColourLabel> */
	public readonly array $colourLabels;

	/** @param array<array-key, mixed> $raw the request's `filters` */
	public function __construct(array $raw) {
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
	}

	/** Whether a picture without a decision, as every Immich asset is in Phase 1, passes the decision filters. */
	public function admitsUndecided(): bool {
		$flagPasses = $this->flags === [] || in_array(Flag::Unflagged, $this->flags, true);
		$ratingPasses = $this->rating === null || $this->rating['op'] === 'atMost' || $this->rating['value'] === 0;
		return $flagPasses && $ratingPasses && $this->colourLabels === [];
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
		if (!is_string($op) || !in_array($op, self::RATING_OPS, true) || !is_int($stars) || $stars < 0 || $stars > self::MAX_RATING) {
			throw self::malformed();
		}
		return ['op' => $op, 'value' => $stars];
	}

	private static function malformed(): ImmichException {
		return new ImmichException(ImmichError::Request);
	}
}
