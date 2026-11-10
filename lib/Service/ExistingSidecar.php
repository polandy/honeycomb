<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A sidecar to save over, with the ETag and size the client read (ADR 0017). */
final readonly class ExistingSidecar {
	/**
	 * @param positive-int $fileId
	 * @param non-empty-string $etag
	 * @param int<0, max> $size
	 */
	public function __construct(
		public int $fileId,
		public string $etag,
		public int $size,
		public string $bytes,
	) {
	}
}
