<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the resume positions of each user are kept, by folder set key. */
interface PositionStore {
	/**
	 * The user's positions, the latest saved first.
	 * @return list<ResumePosition>
	 */
	public function all(string $userId): array;

	/** Stores the position, replacing the one of the same folder set. */
	public function save(string $userId, ResumePosition $position): void;

	/** @param list<string> $folderSetKeys */
	public function forget(string $userId, array $folderSetKeys): void;

	/** Removes every position of the user. */
	public function forgetUser(string $userId): void;
}
