<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Folder;
use OCP\IUser;
use OCP\Share\IManager as IShareManager;

/** Whether other users see a folder's sidecars, so writing through asks first (ADR 0017). */
final class SharedFolders {
	public function __construct(
		private IShareManager $shareManager,
	) {
	}

	public function isShared(IUser $user, Folder $folder): bool {
		if ($folder->getMountPoint()->getMountType() === 'group') {
			return true;
		}
		$access = $this->shareManager->getAccessList($folder, true, false);
		$others = array_diff($access['users'] ?? [], [$user->getUID()]);
		return $others !== [] || ($access['remote'] ?? false) === true;
	}
}
