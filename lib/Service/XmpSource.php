<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where a cached XMP reading came from: a sidecar or a JPEG's embedded XMP (ADR 0032). */
enum XmpSource: string {
	case Sidecar = 'sidecar';
	case Embedded = 'embedded';
}
