<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

/** The per-user limit of every route that writes, far above what one person culling sends (ADR 0031). */
final class WriteRateLimit {
	/** Requests a user may send to one write route per period. */
	public const int LIMIT = 600;
	/** The period of the limit in seconds. */
	public const int PERIOD_SECONDS = 60;
}
