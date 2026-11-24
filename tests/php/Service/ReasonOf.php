<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidRequestException;
use OCA\Honeycomb\Service\Reason;

/** The reason a call refuses its request for, or null when it refuses nothing. */
final class ReasonOf {
	public static function call(\Closure $call): ?Reason {
		try {
			$call();
		} catch (InvalidRequestException $refused) {
			return $refused->reason;
		}
		return null;
	}
}
