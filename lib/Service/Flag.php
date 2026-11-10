<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A picture's flag (Q4); the values are the wire and storage form (ADR 0012). */
enum Flag: string {
	case Picked = 'picked';
	case Rejected = 'rejected';
	case Unflagged = 'unflagged';
}
