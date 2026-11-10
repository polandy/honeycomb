<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The most a sidecar request may carry (ADR 0017). */
final class SidecarLimits {
	public const int MAX_ITEMS = 1000;
	public const int MAX_BYTES = 1_048_576;
}
