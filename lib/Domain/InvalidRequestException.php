<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** A request is malformed: nothing of it is written; the reason goes to the client, the detail stays on the exception for tests and traces. */
final class InvalidRequestException extends \InvalidArgumentException {
	private function __construct(
		public readonly Reason $reason,
		string $detail,
		?\Throwable $previous,
	) {
		parent::__construct($detail, 0, $previous);
	}

	/** The refusal of a request for `$reason`; `$detail` says which part, never sent to the client. */
	public static function because(Reason $reason, string $detail = '', ?\Throwable $previous = null): self {
		return new self($reason, $detail, $previous);
	}
}
