<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The visual hash of one file version, as the browser computed it (ADR 0024). */
final readonly class VisualHash {
	/** The longest etag stored, the width of its column; Nextcloud's are 13 or 32 characters. */
	public const int MAX_ETAG_LENGTH = 40;
	/** A 64-bit dHash, as `src/logic/visual-hash.ts` writes it. */
	private const string HASH_PATTERN = '/^[0-9a-f]{16}$/';
	/** The largest method number, the range of its column. */
	public const int MAX_METHOD = 255;

	public function __construct(
		public int $fileId,
		public string $etag,
		public int $method,
		public string $hash,
	) {
	}

	/**
	 * The hash in a request item, all four fields required.
	 * @throws InvalidVisualHashException for a missing or malformed field
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item)) {
			throw new InvalidVisualHashException('A visual hash item must be an object');
		}
		$fileId = $item['fileId'] ?? null;
		$etag = $item['etag'] ?? null;
		$method = $item['method'] ?? null;
		$hash = $item['hash'] ?? null;
		if (!is_int($fileId) || $fileId < 1) {
			throw new InvalidVisualHashException('fileId must be a positive integer');
		}
		if (!is_string($etag) || $etag === '' || strlen($etag) > self::MAX_ETAG_LENGTH) {
			throw new InvalidVisualHashException("etag of file $fileId must be 1 to " . self::MAX_ETAG_LENGTH . ' characters');
		}
		if (!self::isMethod($method)) {
			throw new InvalidVisualHashException("method of file $fileId must be an integer from 1 to " . self::MAX_METHOD);
		}
		if (!is_string($hash) || preg_match(self::HASH_PATTERN, $hash) !== 1) {
			throw new InvalidVisualHashException("hash of file $fileId must be 16 lower-case hex digits");
		}
		return new self($fileId, $etag, $method, $hash);
	}

	/**
	 * The hash as the listing gives it.
	 * @return array{method: int, hash: string}
	 */
	public function listed(): array {
		return ['method' => $this->method, 'hash' => $this->hash];
	}

	/**
	 * Whether a value is a method number a hash can be stored with.
	 * @psalm-assert-if-true int $method
	 */
	public static function isMethod(mixed $method): bool {
		return is_int($method) && $method >= 1 && $method <= self::MAX_METHOD;
	}
}
