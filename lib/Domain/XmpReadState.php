<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** How a cached XMP reading ended: read, refused with a reason, or no XMP at all (ADR 0032). */
enum XmpReadState: string {
	case Read = 'read';
	case Refused = 'refused';
	case None = 'none';
}
