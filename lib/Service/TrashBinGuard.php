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
	private const NO_LIMIT = '-1';
	// Class names of other apps' storages; not part of OCP, so named, not imported.
	private const TRASH_BIN_STORAGE = 'OCA\Files_Trashbin\Storage';
	private const TEAM_FOLDER_STORAGE = 'OCA\GroupFolders\Mount\GroupFolderStorage';

	public function __construct(
		private IUserConfig $userConfig,
		private IAppConfig $appConfig,
	) {
	}

	/**
	 * Whether deleting `$file` for `$userId` lands in a trash bin, by the rules of `files_trashbin` and Team folders.
	 * @psalm-suppress ArgumentTypeCoercion The storage classes belong to other apps, which psalm does not load.
	 */
	public function keeps(string $userId, File $file): bool {
		$storage = $file->getStorage();
		if (!$storage->instanceOfStorage(self::TRASH_BIN_STORAGE)) {
			return false;
		}
		if ($storage->instanceOfStorage(self::TEAM_FOLDER_STORAGE)) {
			return true;
		}
		$limit = $this->sizeLimit($file->getOwner()?->getUID() ?? $userId);
		return $limit === null || $file->getSize() < $limit;
	}

	/** The owner's trash bin size, else the server's, as `files_trashbin` reads them; null for none. */
	private function sizeLimit(string $owner): ?float {
		$own = $this->userConfig->getValueString($owner, self::TRASH_BIN_APP, self::SIZE_KEY, self::NO_LIMIT);
		if (is_numeric($own) && (float)$own > -1) {
			return (float)$own;
		}
		$server = $this->appConfig->getValueString(self::TRASH_BIN_APP, self::SIZE_KEY, self::NO_LIMIT);
		return is_numeric($server) && (float)$server >= 0 ? (float)$server : null;
	}
}
