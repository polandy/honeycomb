<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Move;

/** What happened to one file of a move request; the values are the wire form (ADR 0018). */
enum MoveResult: string {
	case Moved = 'moved';
	case NotFound = 'notFound';
	case Changed = 'changed';
	case NotPermitted = 'notPermitted';
	case Locked = 'locked';
	case Exists = 'exists';
	case Failed = 'failed';
	case Skipped = 'skipped';
	case MovedBack = 'movedBack';
	case OtherStorage = 'otherStorage';
	case NoTrashBin = 'noTrashBin';
	case TooLarge = 'tooLarge';
}
