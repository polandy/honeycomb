<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** What happened to one sidecar of a lookup or a save; the values are the wire form (ADR 0017). */
enum SidecarResult: string {
	case Read = 'read';
	case Saved = 'saved';
	case NotFound = 'notFound';
	case Changed = 'changed';
	case TooLarge = 'tooLarge';
	case NotPermitted = 'notPermitted';
	case Locked = 'locked';
	case Failed = 'failed';
}
