<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use Psr\Log\LoggerInterface;

/** Lists the child folders of one folder for the folder picker (ADR 0011). */
final class FolderService {
	public function __construct(
		private UserFolderResolver $folders,
		private PhotoFilesBelow $below,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * The direct child folders of the folder at `$path`, hidden ones included, unsorted, each with
	 * the count of its own photo files and of those below it (null for a hidden or unlistable child).
	 * @return list<array{name: string, path: string, hasSubfolders: bool, photoFiles: ?int, photoFilesBelow: ?int}>
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
				$children[] = ['name' => $node->getName(), 'path' => $relative, ...$this->contents($node)];
			}
		}
		return $children;
	}

	/**
	 * Whether `$folder` holds a folder and how many photo files of its own, from one listing, and
	 * how many below it, from the file cache.
	 * @return array{hasSubfolders: bool, photoFiles: ?int, photoFilesBelow: ?int}
	 */
	private function contents(Folder $folder): array {
		try {
			$nodes = $folder->getDirectoryListing();
		} catch (NotPermittedException|NotFoundException) {
			return ['hasSubfolders' => false, 'photoFiles' => null, 'photoFilesBelow' => null];
		}
		$hasSubfolders = false;
		$photoFiles = 0;
		foreach ($nodes as $node) {
			$hasSubfolders = $hasSubfolders || $node instanceof Folder;
			if ($node instanceof File && !str_starts_with($node->getName(), '.') && ListingService::isPhoto($node)) {
				$photoFiles++;
			}
		}
		if (str_starts_with($folder->getName(), '.')) {
			return ['hasSubfolders' => $hasSubfolders, 'photoFiles' => null, 'photoFilesBelow' => null];
		}
		return ['hasSubfolders' => $hasSubfolders, 'photoFiles' => $photoFiles, 'photoFilesBelow' => $this->photoFilesBelow($folder)];
	}

	/** The photo files below `$folder`, or null when the file cache cannot tell. */
	private function photoFilesBelow(Folder $folder): ?int {
		try {
			return $this->below->count($folder);
		} catch (\OCP\DB\Exception $e) {
			$this->logger->warning('Could not count the photo files below a folder.', ['exception' => $e]);
			return null;
		}
	}
}
