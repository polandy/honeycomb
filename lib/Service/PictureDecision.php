<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The whole decision on one file: rating, colour label, flag and Keep RAW (ADR 0012). */
final readonly class PictureDecision implements \JsonSerializable {
	public const int MAX_RATING = 5;

	public function __construct(
		public int $fileId,
		public int $rating,
		public ?ColourLabel $colourLabel,
		public Flag $flag,
		public bool $keepRaw,
	) {
	}

	/**
	 * The decision in a request item, every field required.
	 * @throws InvalidDecisionException for a missing or out-of-range field
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item)) {
			throw new InvalidDecisionException('A decision must be an object');
		}
		$fileId = $item['fileId'] ?? null;
		$rating = $item['rating'] ?? null;
		$colourLabel = $item['colourLabel'] ?? null;
		$flag = $item['flag'] ?? null;
		$keepRaw = $item['keepRaw'] ?? null;
		if (!is_int($fileId) || $fileId < 1) {
			throw new InvalidDecisionException('fileId must be a positive integer');
		}
		if (!is_int($rating) || $rating < 0 || $rating > self::MAX_RATING) {
			throw new InvalidDecisionException("rating of file $fileId must be 0 to " . self::MAX_RATING);
		}
		if ($colourLabel !== null && (!is_string($colourLabel) || ColourLabel::tryFrom($colourLabel) === null)) {
			throw new InvalidDecisionException("colourLabel of file $fileId must be a colour name or null");
		}
		if (!is_string($flag) || Flag::tryFrom($flag) === null) {
			throw new InvalidDecisionException("flag of file $fileId must be picked, rejected or unflagged");
		}
		if (!is_bool($keepRaw)) {
			throw new InvalidDecisionException("keepRaw of file $fileId must be true or false");
		}
		return new self($fileId, $rating, $colourLabel === null ? null : ColourLabel::from($colourLabel), Flag::from($flag), $keepRaw);
	}

	/** Whether nothing was decided, so no row needs to be stored. */
	public function isDefault(): bool {
		return $this->rating === 0 && $this->colourLabel === null && $this->flag === Flag::Unflagged && !$this->keepRaw;
	}

	/** @return array{fileId: int, rating: int, colourLabel: ?string, flag: string, keepRaw: bool} */
	#[\Override]
	public function jsonSerialize(): array {
		return [
			'fileId' => $this->fileId,
			'rating' => $this->rating,
			'colourLabel' => $this->colourLabel?->value,
			'flag' => $this->flag->value,
			'keepRaw' => $this->keepRaw,
		];
	}
}
