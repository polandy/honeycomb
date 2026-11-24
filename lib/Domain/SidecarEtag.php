<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** The ETag of a file's sidecar as honeycomb last knew it, to record on the file's row (ADR 0056). */
final readonly class SidecarEtag {
	public function __construct(
		public int $fileId,
		public ?string $sidecarEtag,
	) {
	}

	/**
	 * The ETag in a request item, both fields required, the ETag null to forget it.
	 * @throws InvalidRequestException for a missing or malformed field
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item)) {
			throw InvalidRequestException::because(Reason::NotAnObject, 'A sidecar ETag must be an object');
		}
		$fileId = $item['fileId'] ?? null;
		if (!is_int($fileId) || $fileId < 1) {
			throw InvalidRequestException::because(Reason::BadFileId, 'fileId must be a positive integer');
		}
		if (!array_key_exists('sidecarEtag', $item)) {
			throw InvalidRequestException::because(Reason::BadEtag, "sidecarEtag of file $fileId is missing");
		}
		return new self($fileId, self::parse($item['sidecarEtag'], $fileId));
	}

	/**
	 * A sidecar ETag of a request, null kept as null.
	 * @throws InvalidRequestException for anything but null or 1 to 40 characters
	 */
	public static function parse(mixed $etag, int $fileId): ?string {
		if ($etag !== null && (!is_string($etag) || $etag === '' || strlen($etag) > VisualHash::MAX_ETAG_LENGTH)) {
			throw InvalidRequestException::because(Reason::BadEtag, "sidecarEtag of file $fileId must be null or 1 to " . VisualHash::MAX_ETAG_LENGTH . ' characters');
		}
		return $etag;
	}
}
