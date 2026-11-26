<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\Security\ICrypto;

/** Signed listing cursors: Immich's cursor bound to the connection, the filters, the first page's time and the anchor a listing from an asset pages around (IMMICH-002.5, .21, .34). */
final class ListingCursors {
	private const string SEPARATOR = '.';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ICrypto $crypto,
	) {
	}

	/** The cursor of the page after Immich's cursor, null for Immich's first; `newer` pages from the anchor towards the newest. */
	public function issue(string $connectionId, ListingFilters $filters, ?string $immichCursor, int $receivedBefore, ?ListingAnchor $anchor = null, bool $newer = false): string {
		$fields = ['c' => $connectionId, 'f' => $filters->fingerprint(), 'i' => $immichCursor, 't' => $receivedBefore];
		if ($anchor !== null) {
			$fields += ['a' => [$anchor->assetId, $anchor->takenAt], 'd' => $newer];
		}
		$payload = json_encode($fields, JSON_THROW_ON_ERROR);
		$encoded = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
		return $encoded . self::SEPARATOR . $this->signature($encoded);
	}

	/**
	 * Immich's cursor, the first page's time and the anchor; a forged cursor or one of another connection or filters is a bad request.
	 * @return array{immich: ?string, receivedBefore: int, anchor: ?ListingAnchor, newer: bool}
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
		/** @var mixed $newer */
		$newer = $payload['d'] ?? false;
		if (($immich !== null && !is_string($immich)) || !is_int($receivedBefore) || !is_bool($newer)) {
			throw new ImmichException(ImmichError::Request);
		}
		return ['immich' => $immich, 'receivedBefore' => $receivedBefore, 'anchor' => self::anchor($payload['a'] ?? null), 'newer' => $newer];
	}

	/** The signed anchor; a cursor the server signed holds a well-formed one or none. */
	private static function anchor(mixed $anchor): ?ListingAnchor {
		if ($anchor === null) {
			return null;
		}
		$assetId = is_array($anchor) ? ($anchor[0] ?? null) : null;
		$takenAt = is_array($anchor) ? ($anchor[1] ?? null) : null;
		if (!is_string($assetId) || !is_int($takenAt)) {
			throw new ImmichException(ImmichError::Request);
		}
		return new ListingAnchor($assetId, $takenAt);
	}

	/** The HMAC in hex: `calculateHMAC` answers raw bytes, which no JSON answer can carry. */
	private function signature(string $encoded): string {
		return bin2hex($this->crypto->calculateHMAC($encoded));
	}
}
