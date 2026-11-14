<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Whether the user has finished a stored series (ADR 0027). */
enum SeriesStatus: string {
	case Open = 'open';
	case Done = 'done';
}
