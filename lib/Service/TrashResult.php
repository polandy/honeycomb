<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** What happened to one file of a trash request; the values are the wire form (ADR 0013). */
enum TrashResult: string {
	case Trashed = 'trashed';
	case Deleted = 'deleted';
	case NotFound = 'notFound';
	case Changed = 'changed';
	case NotPermitted = 'notPermitted';
	case NoTrashBin = 'noTrashBin';
	case TooLarge = 'tooLarge';
	case Locked = 'locked';
	case Failed = 'failed';
	case Skipped = 'skipped';
	case DecisionChanged = 'decisionChanged';
}
