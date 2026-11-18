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
use OCP\Share\IShare;

/** Whether folders of one listing are shared, reading the user's shares once (LISTING-001.17). */
final class SharedFolderLookup {
	/** The share types that can give someone else access to a file of the user's. */
	private const SHARE_TYPES = [
		IShare::TYPE_USER, IShare::TYPE_GROUP, IShare::TYPE_LINK, IShare::TYPE_EMAIL, IShare::TYPE_REMOTE,
		IShare::TYPE_CIRCLE, IShare::TYPE_GUEST, IShare::TYPE_REMOTE_GROUP, IShare::TYPE_ROOM, IShare::TYPE_DECK,
	];
	private const ALL_SHARES = -1;

	/** @var array<string, bool> by absolute folder path */
	private array $shared = [];
	/** @var array<int, bool> by numeric storage id */
	private array $mountedForOthers = [];
	/** @var ?array<int, true> the file ids that carry a share, read on first use */
	private ?array $sharedIds = null;

	public function __construct(
		private IUser $user,
		private string $userFolderPath,
		private IShareManager $shareManager,
		private IUserMountCache $mountCache,
	) {
	}

	/** Whether another user has access to the folder or a folder above it, or sees the mount it lies on (ADR 0017). */
	public function isShared(Folder $folder): bool {
		return $this->shared[$folder->getPath()] ??= $this->lookUp($folder);
	}

	private function lookUp(Folder $folder): bool {
		$mount = $folder->getMountPoint();
		$type = $mount->getMountType();
		if ($type === 'group' || $type === 'shared' || ($type === 'external' && $this->isMountedForOthers((int)$mount->getNumericStorageId()))) {
			return true;
		}
		if (!str_starts_with($folder->getPath(), $this->userFolderPath . '/')) {
			return false;
		}
		$parent = $folder->getParent();
		// Below an unshared parent, the folder's own shares decide, so its access list need not climb.
		return ($parent instanceof Folder && $this->isShared($parent))
			|| (isset($this->sharedIds()[$folder->getId()]) && $this->hasShares($folder));
	}

	private function hasShares(Folder $folder): bool {
		$access = $this->shareManager->getAccessList($folder, false, false);
		$others = array_diff($access['users'] ?? [], [$this->user->getUID()]);
		return $others !== []
			|| ($access['remote'] ?? false) === true
			|| ($access['public'] ?? false) === true
			|| ($access['mail'] ?? []) !== [];
	}

	/** @return array<int, true> */
	private function sharedIds(): array {
		if ($this->sharedIds === null) {
			$this->sharedIds = [];
			foreach (self::SHARE_TYPES as $type) {
				foreach ($this->shareManager->getSharesBy($this->user->getUID(), $type, null, true, self::ALL_SHARES, 0, false) as $share) {
					$this->sharedIds[$share->getNodeId()] = true;
				}
			}
		}
		return $this->sharedIds;
	}

	private function isMountedForOthers(int $storageId): bool {
		return $this->mountedForOthers[$storageId] ??= array_diff(
			array_map(fn (ICachedMountInfo $mount): string => $mount->getUser()->getUID(), $this->mountCache->getMountsForStorageId($storageId)),
			[$this->user->getUID()],
		) !== [];
	}
}
