<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The one flag and Keep RAW of a file, shared by everyone who reaches it (ADR 0040). */
final readonly class FileFlag {
	public function __construct(
		public int $fileId,
		public Flag $flag,
		public bool $keepRaw,
		public int $updatedAt,
	) {
	}

	/**
	 * The flag in a request item, every field required, stamped `$updatedAt`.
	 * @throws InvalidFlagException for a missing or unknown field
	 */
	public static function fromRequest(mixed $item, int $updatedAt): self {
		if (!is_array($item)) {
			throw new InvalidFlagException('A flag must be an object');
		}
		$fileId = $item['fileId'] ?? null;
		$flag = $item['flag'] ?? null;
		$keepRaw = $item['keepRaw'] ?? null;
		if (!is_int($fileId) || $fileId < 1) {
			throw new InvalidFlagException('fileId must be a positive integer');
		}
		if (!is_string($flag) || Flag::tryFrom($flag) === null) {
			throw new InvalidFlagException("flag of file $fileId must be picked, rejected or unflagged");
		}
		if (!is_bool($keepRaw)) {
			throw new InvalidFlagException("keepRaw of file $fileId must be true or false");
		}
		return new self($fileId, Flag::from($flag), $keepRaw, $updatedAt);
	}
}
