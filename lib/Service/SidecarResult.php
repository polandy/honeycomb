<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;

/** What happened to one sidecar of a lookup or a save, or to an embedded XMP lookup; the values are the wire form (ADR 0017, ADR 0023). */
enum SidecarResult: string {
	case Read = 'read';
	case Saved = 'saved';
	case NotFound = 'notFound';
	case Changed = 'changed';
	case TooLarge = 'tooLarge';
	case NotPermitted = 'notPermitted';
	case Locked = 'locked';
	case Failed = 'failed';
	case NoPacket = 'none';

	/** The result a failure to read a file answers; `Failed` for any the caller must log. */
	public static function ofFailure(\Exception $e): self {
		return match (true) {
			$e instanceof NotPermittedException => self::NotPermitted,
			$e instanceof LockedException => self::Locked,
			$e instanceof NotFoundException => self::NotFound,
			default => self::Failed,
		};
	}
}
