<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** Reads each user's tag list (ADR 0022). */
final class TagService {
	public function __construct(
		private TagStore $store,
	) {
	}

	/**
	 * Every tag the user has had, sorted, each once.
	 * @return list<string>
	 */
	public function tagList(IUser $user): array {
		return $this->store->tagList($user->getUID());
	}
}
