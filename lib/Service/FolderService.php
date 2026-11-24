<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\OrphanedSidecarRule;
use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Domain\PhotoFiles;
use OCA\Honeycomb\Domain\PictureCount;
use OCA\Honeycomb\Domain\PictureTally;
use OCA\Honeycomb\Domain\Store\PicturesBelow;
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
		private PicturesBelow $below,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * The direct child folders of the folder at `$path`, hidden ones included, unsorted, each with
	 * the counts of its own pictures and orphaned sidecars and of those below it (null for a hidden or unlistable child),
	 * pictures paired by `$extensions`.
	 * @return list<array{name: string, path: string, hasSubfolders: bool, pictures: ?int, picturesBelow: ?int, picturesBelowApproximate: bool, orphanedSidecars: ?int, orphanedSidecarsBelow: ?int}>
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function children(IUser $user, string $path, PairingExtensions $extensions): array {
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
				$children[] = ['name' => $node->getName(), 'path' => $relative, ...$this->contents($node, $extensions)];
			}
		}
		return $children;
	}

	/**
	 * Whether `$folder` holds a folder and how many pictures and orphaned sidecars of its own, from
	 * one listing, and how many below it, from the file cache.
	 * @return array{hasSubfolders: bool, pictures: ?int, picturesBelow: ?int, picturesBelowApproximate: bool, orphanedSidecars: ?int, orphanedSidecarsBelow: ?int}
	 */
	private function contents(Folder $folder, PairingExtensions $extensions): array {
		try {
			$nodes = $folder->getDirectoryListing();
		} catch (NotPermittedException|NotFoundException) {
			return ['hasSubfolders' => false, 'pictures' => null, 'picturesBelow' => null, 'picturesBelowApproximate' => false, 'orphanedSidecars' => null, 'orphanedSidecarsBelow' => null];
		}
		$hasSubfolders = false;
		$photos = $videos = $sidecars = [];
		foreach ($nodes as $node) {
			$hasSubfolders = $hasSubfolders || $node instanceof Folder;
			if (!$node instanceof File || str_starts_with($node->getName(), '.')) {
				continue;
			}
			if (PhotoFiles::isSidecar($node)) {
				$sidecars[] = $node->getName();
			} elseif (PhotoFiles::isPhoto($node)) {
				$photos[] = $node->getName();
			} elseif (OrphanedSidecarRule::isVideo($node)) {
				$videos[] = $node->getName();
			}
		}
		if (str_starts_with($folder->getName(), '.')) {
			return ['hasSubfolders' => $hasSubfolders, 'pictures' => null, 'picturesBelow' => null, 'picturesBelowApproximate' => false, 'orphanedSidecars' => null, 'orphanedSidecarsBelow' => null];
		}
		$own = PictureTally::of($photos, $videos, $sidecars, $extensions);
		$below = $this->picturesBelow($folder, $extensions);
		return [
			'hasSubfolders' => $hasSubfolders,
			'pictures' => $own['pictures'],
			'picturesBelow' => $below?->pictures,
			'picturesBelowApproximate' => $below?->approximate ?? false,
			'orphanedSidecars' => $own['orphans'],
			'orphanedSidecarsBelow' => $below?->orphans,
		];
	}

	/** The pictures and orphaned sidecars below `$folder`, or null when the file cache cannot tell. */
	private function picturesBelow(Folder $folder, PairingExtensions $extensions): ?PictureCount {
		try {
			return $this->below->count($folder, $extensions);
		} catch (\OCP\DB\Exception $e) {
			$this->logger->warning('Could not count the pictures below a folder.', ['exception' => $e]);
			return null;
		}
	}
}
