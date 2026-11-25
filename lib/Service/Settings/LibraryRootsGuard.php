<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Settings;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\LibraryRootPaths;
use OCA\Honeycomb\Domain\Reason;
use OCP\IUser;

/** Refuses a folder to work in that lies outside the user's library roots (SETTINGS-001.36). */
final class LibraryRootsGuard {
	public function __construct(
		private SettingsService $settings,
	) {
	}

	/** @throws InvalidRequestException with `bad-path` when roots are set and the path lies in none */
	public function ensureInside(IUser $user, string $path): void {
		$roots = $this->settings->get($user)->libraryRoots ?? [];
		if (!is_array($roots) || $roots === []) {
			return;
		}
		/** @var mixed $root */
		foreach ($roots as $root) {
			if (is_string($root) && LibraryRootPaths::isInside($path, LibraryRootPaths::normalize($root))) {
				return;
			}
		}
		throw InvalidRequestException::because(Reason::BadPath, 'the folder lies outside your library roots');
	}
}
