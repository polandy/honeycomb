<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Folder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;

/** Lists the child folders of one folder for the folder picker (ADR 0011). */
final class FolderService {
	public function __construct(
		private UserFolderResolver $folders,
	) {
	}

	/**
	 * The direct child folders of the folder at `$path`, hidden ones included, unsorted.
	 * @return list<array{name: string, path: string, hasSubfolders: bool}>
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function children(IUser $user, string $path): array {
		$folder = $this->folders->folder($user, $path);
		$userFolder = $this->folders->userFolder($user);
		try {
			$nodes = $folder->getDirectoryListing();
		} catch (NotPermittedException) {
			throw new FolderNotReadableException($path);
		}
		$children = [];
		foreach ($nodes as $node) {
			$relative = $userFolder->getRelativePath($node->getPath());
			if ($node instanceof Folder && $relative !== null) {
				$children[] = ['name' => $node->getName(), 'path' => $relative, 'hasSubfolders' => $this->hasSubfolders($node)];
			}
		}
		return $children;
	}

	private function hasSubfolders(Folder $folder): bool {
		try {
			foreach ($folder->getDirectoryListing() as $node) {
				if ($node instanceof Folder) {
					return true;
				}
			}
		} catch (NotPermittedException|NotFoundException) {
			return false;
		}
		return false;
	}
}
