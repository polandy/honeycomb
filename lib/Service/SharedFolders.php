<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Config\IUserMountCache;
use OCP\Files\Folder;
use OCP\IUser;
use OCP\Share\IManager as IShareManager;

/** Whether others see a folder's sidecars, so writing through asks first (ADR 0017). */
final class SharedFolders {
	public function __construct(
		private IShareManager $shareManager,
		private IUserMountCache $mountCache,
	) {
	}

	/** A lookup for one listing of the user's files, which reads the user's shares at most once. */
	public function lookup(IUser $user, Folder $userFolder): SharedFolderLookup {
		return new SharedFolderLookup($user, $userFolder->getPath(), $this->shareManager, $this->mountCache);
	}
}
