<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Preview\UntypedRaw;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\Files\NotPermittedException;
use OCP\IUser;

/** Lists the files of one picked folder from the file cache: members and sidecars, unpaired. */
final class ListingService {
	/** 20,000 pictures of a RAW, a JPEG and a sidecar each (`docs/plan.md` Multiple folders). */
	public const ENTRY_LIMIT = 60_000;
	public const METADATA_BATCH = 1_000;

	public function __construct(
		private UserFolderResolver $folders,
		private EntryFactory $entryFactory,
		private SharedFolders $sharedFolders,
		private int $entryLimit = self::ENTRY_LIMIT,
	) {
	}

	/**
	 * Entries of the folder at `$path` in the user's files, with `$subfolders` of every folder below
	 * except hidden ones, at most the entry limit.
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function list(IUser $user, string $path, bool $subfolders): Listing {
		$folder = $this->folders->folder($user, $path);
		$userFolder = $this->folders->userFolder($user);
		try {
			return $this->collect($user, $userFolder, $folder, $subfolders ? $this->walkBelow($folder) : $folder->getDirectoryListing());
		} catch (NotPermittedException) {
			throw new FolderNotReadableException($path);
		}
	}

	/** @param iterable<Node> $nodes */
	private function collect(IUser $user, Folder $userFolder, Folder $folder, iterable $nodes): Listing {
		$entries = [];
		$batch = [];
		$folders = [];
		foreach ($nodes as $node) {
			if (!$this->isListed($folder, $node)) {
				continue;
			}
			if (count($entries) + count($batch) === $this->entryLimit) {
				return new Listing([...$entries, ...$this->entryFactory->create($user->getUID(), $userFolder, $batch)], true, array_values($folders));
			}
			$batch[] = $node;
			$folders[dirname($node->getPath())] ??= $this->folderOf($user, $userFolder, $node);
			if (count($batch) === self::METADATA_BATCH) {
				array_push($entries, ...$this->entryFactory->create($user->getUID(), $userFolder, $batch));
				$batch = [];
			}
		}
		return new Listing([...$entries, ...$this->entryFactory->create($user->getUID(), $userFolder, $batch)], false, array_values($folders));
	}

	/** @return array{path: string, shared: bool} */
	private function folderOf(IUser $user, Folder $userFolder, File $node): array {
		$path = $userFolder->getRelativePath(dirname($node->getPath())) ?? '/';
		return ['path' => $path, 'shared' => $this->sharedFolders->isShared($user, $node->getParent())];
	}

	/** @psalm-assert-if-true File $node */
	private function isListed(Folder $folder, Node $node): bool {
		if (!$node instanceof File) {
			return false;
		}
		$relative = $folder->getRelativePath($node->getPath());
		if ($relative === null || preg_match('#/\.#', $relative) === 1) {
			return false;
		}
		return self::isListedType($node);
	}

	/** Whether the listing lists a file of this type: a photo or an XMP sidecar. */
	public static function isListedType(File $file): bool {
		return self::isPhoto($file) || self::isSidecar($file);
	}

	/** Whether the file is an image, including RAW files Nextcloud does not type. */
	public static function isPhoto(File $file): bool {
		return str_starts_with($file->getMimetype(), 'image/') || UntypedRaw::isNamed($file->getName());
	}

	public static function isSidecar(File $file): bool {
		return str_ends_with(strtolower($file->getName()), '.xmp');
	}

	/**
	 * The files of `$folder` and of every folder below it, depth first, one listing per folder;
	 * hidden folders and those the user may not read are never opened.
	 * @return \Generator<Node>
	 */
	private function walkBelow(Folder $folder): \Generator {
		$pending = [$folder];
		while (($current = array_pop($pending)) !== null) {
			$subfolders = [];
			foreach ($current->getDirectoryListing() as $node) {
				if (!$node instanceof Folder) {
					yield $node;
				} elseif (!str_starts_with($node->getName(), '.') && $node->isReadable()) {
					$subfolders[] = $node;
				}
			}
			array_push($pending, ...array_reverse($subfolders));
		}
	}
}
