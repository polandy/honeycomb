<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** What a flag write saved and what it skipped, with the reason, in the request's order. */
final readonly class FlagAnswer implements \JsonSerializable {
	/** The file is not one of the user's photos. */
	public const string NOT_FOUND = 'notFound';
	/** The user may read the photo but not set its flag. */
	public const string NOT_PERMITTED = 'notPermitted';
	/** A take-over found a row already there. */
	public const string EXISTS = 'exists';

	/**
	 * @param list<int> $saved
	 * @param list<array{fileId: int, reason: string}> $skipped
	 */
	public function __construct(
		private array $saved,
		private array $skipped,
	) {
	}

	/** @return array{saved: list<int>, skipped: list<array{fileId: int, reason: string}>} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['saved' => $this->saved, 'skipped' => $this->skipped];
	}
}
