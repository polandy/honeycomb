<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Trash;

use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\Flag;

/** The state a trash request expects of each picture's rows; the values are the wire form (ADR 0040). */
enum TrashExpectation: string {
	case Rejected = 'rejected';
	case RawRemovable = 'rawRemovable';

	/**
	 * Whether the rows of a picture's members still say this state; a member without a row is unflagged.
	 * @param list<?FileFlag> $members
	 */
	public function holds(array $members): bool {
		foreach ($members as $member) {
			$holds = match ($this) {
				self::Rejected => $member?->flag === Flag::Rejected,
				self::RawRemovable => $member === null || ($member->flag !== Flag::Rejected && !$member->keepRaw),
			};
			if (!$holds) {
				return false;
			}
		}
		return true;
	}
}
