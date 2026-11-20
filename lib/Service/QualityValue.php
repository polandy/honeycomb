<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The quality value of one file version, as the browser measured it (ADR 0046). */
final readonly class QualityValue {
	/** The largest method number, the range of its column. */
	private const int MAX_METHOD = 255;
	/** The last tile of the 8 × 8 grid, as `src/logic/sharpness.ts` numbers it. */
	private const int MAX_FOCUS_TILE = 63;

	public function __construct(
		public int $fileId,
		public string $etag,
		public int $method,
		public float $sharpness,
		public int $focusTile,
	) {
	}

	/**
	 * The value in a request item, every field required.
	 * @throws InvalidQualityValueException for a missing or malformed field
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item)) {
			throw new InvalidQualityValueException('A quality value item must be an object');
		}
		$fileId = $item['fileId'] ?? null;
		$etag = $item['etag'] ?? null;
		$method = $item['method'] ?? null;
		$sharpness = $item['sharpness'] ?? null;
		$focusTile = $item['focusTile'] ?? null;
		if (!is_int($fileId) || $fileId < 1) {
			throw new InvalidQualityValueException('fileId must be a positive integer');
		}
		if (!is_string($etag) || $etag === '' || strlen($etag) > VisualHash::MAX_ETAG_LENGTH) {
			throw new InvalidQualityValueException("etag of file $fileId must be 1 to " . VisualHash::MAX_ETAG_LENGTH . ' characters');
		}
		if (!is_int($method) || $method < 1 || $method > self::MAX_METHOD) {
			throw new InvalidQualityValueException("method of file $fileId must be an integer from 1 to " . self::MAX_METHOD);
		}
		if (!(is_int($sharpness) || is_float($sharpness)) || !is_finite((float)$sharpness) || $sharpness < 0) {
			throw new InvalidQualityValueException("sharpness of file $fileId must be a number of at least 0");
		}
		if (!is_int($focusTile) || $focusTile < 0 || $focusTile > self::MAX_FOCUS_TILE) {
			throw new InvalidQualityValueException("focusTile of file $fileId must be an integer from 0 to " . self::MAX_FOCUS_TILE);
		}
		return new self($fileId, $etag, $method, (float)$sharpness, $focusTile);
	}

	/**
	 * The value as the listing gives it.
	 * @return array{method: int, sharpness: float, focusTile: int}
	 */
	public function listed(): array {
		return ['method' => $this->method, 'sharpness' => $this->sharpness, 'focusTile' => $this->focusTile];
	}
}
