<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Settings;

use OCA\Honeycomb\Service\Settings\LibraryRootsGuard;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCP\Config\IUserConfig;

/** A `LibraryRootsGuard` over the library roots of every user. */
trait FakeRoots {
	/** @param list<string> $roots */
	private function rootsGuard(array $roots = []): LibraryRootsGuard {
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnCallback(
			static fn (string $userId, string $app, string $key, string $default = ''): string => $key === 'library_roots' && $roots !== [] ? json_encode($roots, JSON_THROW_ON_ERROR) : $default,
		);
		return new LibraryRootsGuard(new SettingsService($config));
	}
}
