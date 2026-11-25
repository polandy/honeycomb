<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** Why *Mark all done* left a folder as it was (FOLDERS-006.15). */
enum DoneSkip: string {
	case ReadOnly = 'read-only';
	case Done = 'done';
}
