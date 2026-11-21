<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The background jobs `occ honeycomb:jobs` reports (APP-003). */
enum BackgroundJobName: string {
	case Sweep = 'sweep';
	case WarmUp = 'warm-up';
}
