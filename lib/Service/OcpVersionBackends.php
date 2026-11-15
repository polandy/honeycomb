<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Storage\IStorage;
use Psr\Container\ContainerInterface;

/**
 * Asks the version manager of `files_versions` for a storage's backend.
 * @psalm-suppress UnusedClass Nextcloud constructs it through its alias.
 */
final class OcpVersionBackends implements VersionBackends {
	// Class names of `files_versions`; not part of OCP, so named, not imported.
	private const string VERSION_MANAGER = 'OCA\Files_Versions\Versions\IVersionManager';
	private const string BACKEND_NOT_FOUND = 'OCA\Files_Versions\Versions\BackendNotFoundException';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through its alias. */
	public function __construct(
		private ContainerInterface $container,
	) {
	}

	/** @psalm-suppress MixedAssignment, MixedMethodCall, ArgumentTypeCoercion The version manager belongs to another app, which psalm does not load. */
	#[\Override]
	public function existFor(IStorage $storage): bool {
		// Asked only once `files_versions` is enabled, so its manager is registered.
		$manager = $this->container->get(self::VERSION_MANAGER);
		try {
			$manager->getBackendForStorage($storage);
			return true;
		} catch (\Exception $e) {
			return is_a($e, self::BACKEND_NOT_FOUND) ? false : throw $e;
		}
	}
}
