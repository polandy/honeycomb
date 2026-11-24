<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** What was malformed in a request; the values are the wire form of `reason` (APP-004, ADR 0057). */
enum Reason: string {
	case NotAnObject = 'not-an-object';
	case NotAList = 'not-a-list';
	case TooMany = 'too-many';
	case BadFileId = 'bad-file-id';
	case BadEtag = 'bad-etag';
	case Duplicate = 'duplicate';
	case Conflict = 'conflict';
	case BadValue = 'bad-value';
	case BadPath = 'bad-path';
	case BadCursor = 'bad-cursor';
	case TooLarge = 'too-large';
	case UnknownName = 'unknown-name';
}
