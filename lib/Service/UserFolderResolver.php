<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Folder;
use OCP\Files\InvalidPathException;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;

/** Resolves a path from a request to a readable folder in the user's files. */
final class UserFolderResolver {
	public function __construct(
		private IRootFolder $rootFolder,
	) {
	}

	public function userFolder(IUser $user): Folder {
		return $this->rootFolder->getUserFolder($user->getUID());
	}

	/**
	 * The folder at `$path` in the user's files.
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function folder(IUser $user, string $path): Folder {
		if (in_array('..', explode('/', $path), true) || str_contains($path, "\0")) {
			throw new FolderNotFoundException($path);
		}
		$userFolder = $this->userFolder($user);
		try {
			$node = $userFolder->get($path);
		} catch (NotFoundException|InvalidPathException) {
			throw new FolderNotFoundException($path);
		} catch (NotPermittedException) {
			throw new FolderNotReadableException($path);
		}
		if (!$node instanceof Folder || $userFolder->getRelativePath($node->getPath()) === null) {
			throw new FolderNotFoundException($path);
		}
		if (!$node->isReadable()) {
			throw new FolderNotReadableException($path);
		}
		return $node;
	}
}
