<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** An Immich call failed; the message is only the error code, never a path, key or upstream text (ADR 0042). */
final class ImmichException extends \RuntimeException {
	public function __construct(
		public readonly ImmichError $error,
		public readonly ?string $scope = null,
	) {
		parent::__construct($error->value);
	}
}
