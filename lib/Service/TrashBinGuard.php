<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Config\IUserConfig;
use OCP\Files\File;
use OCP\IAppConfig;

/** Tells whether Nextcloud's trash bin would keep a file instead of deleting it for good (ADR 0030). */
final class TrashBinGuard {
	private const TRASH_BIN_APP = 'files_trashbin';
	private const SIZE_KEY = 'trashbin_size';
	private const QUOTA_BASED = '-1';
	// Class names of other apps' storages; not part of OCP, so named, not imported.
	private const TRASH_BIN_STORAGE = 'OCA\Files_Trashbin\Storage';
	private const TEAM_FOLDER_STORAGE = 'OCA\GroupFolders\Mount\GroupFolderStorage';

	public function __construct(
		private IUserConfig $userConfig,
		private IAppConfig $appConfig,
	) {
	}

	/**
	 * Why deleting `$file` for `$userId` would not land in a trash bin, by the rules of `files_trashbin` and Team folders; null when it would.
	 * @psalm-suppress ArgumentTypeCoercion The storage classes belong to other apps, which psalm does not load.
	 */
	public function refusal(string $userId, File $file): ?TrashResult {
		$storage = $file->getStorage();
		if (!$storage->instanceOfStorage(self::TRASH_BIN_STORAGE)) {
			return TrashResult::NoTrashBin;
		}
		if ($storage->instanceOfStorage(self::TEAM_FOLDER_STORAGE)) {
			return null;
		}
		$limit = $this->sizeLimit($file->getOwner()?->getUID() ?? $userId) ?? $this->freeQuota($file);
		return $limit === null || $file->getSize() < $limit ? null : TrashResult::TooLarge;
	}

	/** The owner's trash bin size, else the server's, as `files_trashbin` reads them; null when it is -1, the free quota. */
	private function sizeLimit(string $owner): ?float {
		$own = $this->userConfig->getValueString($owner, self::TRASH_BIN_APP, self::SIZE_KEY, self::QUOTA_BASED);
		if (is_numeric($own) && (float)$own > -1) {
			return (float)$own;
		}
		$server = $this->appConfig->getValueString(self::TRASH_BIN_APP, self::SIZE_KEY, self::QUOTA_BASED);
		return is_numeric($server) && (float)$server >= 0 ? (float)$server : null;
	}

	/** The quota the owner has left where `$file` lies; null when unlimited or unknown. */
	private function freeQuota(File $file): ?float {
		$free = $file->getParent()->getFreeSpace();
		return $free >= 0 ? (float)$free : null;
	}
}
