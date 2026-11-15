<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\App\IAppManager;
use OCP\Files\Node;

/** Tells whether Nextcloud keeps a version of a node it replaces, by the node's owner and storage (ADR 0032). */
final class FileVersions {
	private const string VERSIONS_APP = 'files_versions';
	/** The mount type of external storage, whose versions `files_versions` does not keep. */
	private const string EXTERNAL_MOUNT = 'external';

	public function __construct(
		private IAppManager $appManager,
		private VersionBackends $backends,
	) {
	}

	/** True when replacing a file in `$node` keeps the old bytes as a version. */
	public function keeps(Node $node): bool {
		$owner = $node->getOwner();
		return $owner !== null
			&& $this->appManager->isEnabledForUser(self::VERSIONS_APP, $owner)
			&& $node->getMountPoint()->getMountType() !== self::EXTERNAL_MOUNT
			&& $this->backends->existFor($node->getStorage());
	}
}
