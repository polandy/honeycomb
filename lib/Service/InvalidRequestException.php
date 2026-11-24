<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A request is malformed: nothing of it is written; the reason goes to the client, the detail to the log. */
final class InvalidRequestException extends \InvalidArgumentException {
	private function __construct(
		public readonly Reason $reason,
		string $detail,
		?\Throwable $previous,
	) {
		parent::__construct($detail, 0, $previous);
	}

	/** The refusal of a request for `$reason`; `$detail` says which part, for the log only. */
	public static function because(Reason $reason, string $detail = '', ?\Throwable $previous = null): self {
		return new self($reason, $detail, $previous);
	}
}
