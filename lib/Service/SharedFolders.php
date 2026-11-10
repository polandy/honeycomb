<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Config\ICachedMountInfo;
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

	public function isShared(IUser $user, Folder $folder): bool {
		$mount = $folder->getMountPoint();
		return match ($mount->getMountType()) {
			'group' => true,
			'external' => $this->isMountedForOthers($user, (int)$mount->getNumericStorageId()) || $this->hasShares($user, $folder),
			default => $this->hasShares($user, $folder),
		};
	}

	private function hasShares(IUser $user, Folder $folder): bool {
		$access = $this->shareManager->getAccessList($folder, true, false);
		$others = array_diff($access['users'] ?? [], [$user->getUID()]);
		return $others !== []
			|| ($access['remote'] ?? false) === true
			|| ($access['public'] ?? false) === true
			|| ($access['mail'] ?? []) !== [];
	}

	private function isMountedForOthers(IUser $user, int $storageId): bool {
		$users = array_map(fn (ICachedMountInfo $mount): string => $mount->getUser()->getUID(), $this->mountCache->getMountsForStorageId($storageId));
		return array_diff($users, [$user->getUID()]) !== [];
	}
}
