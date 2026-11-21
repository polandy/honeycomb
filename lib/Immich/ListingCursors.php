<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\Security\ICrypto;

/** Signed listing cursors: Immich's cursor bound to the connection, the filters and the first page's time (IMMICH-002.5, .21). */
final class ListingCursors {
	private const string SEPARATOR = '.';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ICrypto $crypto,
	) {
	}

	/** The cursor of the page after Immich's cursor. */
	public function issue(string $connectionId, ListingFilters $filters, string $immichCursor, int $receivedBefore): string {
		$payload = json_encode(['c' => $connectionId, 'f' => $filters->fingerprint(), 'i' => $immichCursor, 't' => $receivedBefore], JSON_THROW_ON_ERROR);
		$encoded = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
		return $encoded . self::SEPARATOR . $this->signature($encoded);
	}

	/**
	 * Immich's cursor and the first page's time; a forged cursor or one of another connection or filters is a bad request.
	 * @return array{immich: string, receivedBefore: int}
	 */
	public function open(string $cursor, string $connectionId, ListingFilters $filters): array {
		$parts = explode(self::SEPARATOR, $cursor);
		if (count($parts) !== 2 || $parts[0] === '' || !hash_equals($this->signature($parts[0]), $parts[1])) {
			throw new ImmichException(ImmichError::Request);
		}
		$decoded = base64_decode(strtr($parts[0], '-_', '+/'), true);
		try {
			/** @var mixed $payload */
			$payload = json_decode((string)$decoded, true, 4, JSON_THROW_ON_ERROR);
		} catch (\JsonException) {
			throw new ImmichException(ImmichError::Request);
		}
		if (!is_array($payload) || ($payload['c'] ?? null) !== $connectionId || ($payload['f'] ?? null) !== $filters->fingerprint()) {
			throw new ImmichException(ImmichError::Request);
		}
		/** @var mixed $immich */
		$immich = $payload['i'] ?? null;
		/** @var mixed $receivedBefore */
		$receivedBefore = $payload['t'] ?? null;
		if (!is_string($immich) || !is_int($receivedBefore)) {
			throw new ImmichException(ImmichError::Request);
		}
		return ['immich' => $immich, 'receivedBefore' => $receivedBefore];
	}

	/** The HMAC in hex: `calculateHMAC` answers raw bytes, which no JSON answer can carry. */
	private function signature(string $encoded): string {
		return bin2hex($this->crypto->calculateHMAC($encoded));
	}
}
