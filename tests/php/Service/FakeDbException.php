<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\DB\Exception;

/**
 * A database error with a chosen reason, as the real connection reports it.
 * @psalm-suppress ImmutableDependency The stub marks the base immutable; the fake only carries a reason.
 */
final class FakeDbException extends Exception {
	public function __construct(
		private int $reason,
	) {
		parent::__construct('database error ' . $reason);
	}

	/** @psalm-suppress MoreSpecificReturnType, LessSpecificReturnStatement The reason is any `Exception::REASON_*`. */
	#[\Override]
	public function getReason(): ?int {
		return $this->reason;
	}
}
