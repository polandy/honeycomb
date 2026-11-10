<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Search\BinaryOperator;
use OCA\Honeycomb\Search\Comparison;
use OCA\Honeycomb\Search\FileSearchQuery;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\InvalidPathException;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\Search\ISearchBinaryOperator;
use OCP\Files\Search\ISearchComparison;
use OCP\IUser;

/** Lists the files of a folder set from the file cache: pictures' members and sidecars, unpaired. */
final class ListingService {
	/** 20,000 pictures of a RAW, a JPEG and a sidecar each (`docs/plan.md` Multiple folders). */
	public const ENTRY_LIMIT = 60_000;
	public const PAGE_SIZE = 5_000;
	public const METADATA_BATCH = 1_000;

	public function __construct(
		private IRootFolder $rootFolder,
		private EntryFactory $entryFactory,
		private int $entryLimit = self::ENTRY_LIMIT,
		private int $pageSize = self::PAGE_SIZE,
	) {
	}

	/**
	 * Entries of the folder at `$path` in the user's files, with `$subfolders` of every folder below
	 * except hidden ones, at most the entry limit.
	 * @throws FolderNotFoundException for a foreign, vanished or non-folder path
	 * @throws FolderNotReadableException when the user may not read the folder
	 */
	public function list(IUser $user, string $path, bool $subfolders): Listing {
		if (in_array('..', explode('/', $path), true) || str_contains($path, "\0")) {
			throw new FolderNotFoundException($path);
		}
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		$folder = $this->folderAt($userFolder, $path);
		try {
			return $this->collect($userFolder, $folder, $subfolders ? $this->searchBelow($user, $folder) : $folder->getDirectoryListing());
		} catch (NotPermittedException) {
			throw new FolderNotReadableException($path);
		}
	}

	private function folderAt(Folder $userFolder, string $path): Folder {
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

	/** @param iterable<Node> $nodes */
	private function collect(Folder $userFolder, Folder $folder, iterable $nodes): Listing {
		$entries = [];
		$batch = [];
		foreach ($nodes as $node) {
			if (!$this->isListed($folder, $node)) {
				continue;
			}
			if (count($entries) + count($batch) === $this->entryLimit) {
				return new Listing([...$entries, ...$this->entryFactory->create($userFolder, $batch)], true);
			}
			$batch[] = $node;
			if (count($batch) === self::METADATA_BATCH) {
				array_push($entries, ...$this->entryFactory->create($userFolder, $batch));
				$batch = [];
			}
		}
		return new Listing([...$entries, ...$this->entryFactory->create($userFolder, $batch)], false);
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
		return str_starts_with($node->getMimetype(), 'image/') || str_ends_with(strtolower($node->getName()), '.xmp');
	}

	/** @return \Generator<Node> */
	private function searchBelow(IUser $user, Folder $folder): \Generator {
		$cursor = 0;
		do {
			$page = $folder->search(new FileSearchQuery($this->picturesAndSidecarsAfter($cursor), $this->pageSize, $user));
			foreach ($page as $node) {
				$cursor = $node->getId();
				yield $node;
			}
		} while (count($page) === $this->pageSize);
	}

	private function picturesAndSidecarsAfter(int $cursor): BinaryOperator {
		return new BinaryOperator(ISearchBinaryOperator::OPERATOR_AND, [
			new BinaryOperator(ISearchBinaryOperator::OPERATOR_OR, [
				new Comparison(ISearchComparison::COMPARE_LIKE, 'mimetype', 'image/%'),
				new Comparison(ISearchComparison::COMPARE_LIKE, 'name', '%.xmp'),
			]),
			new Comparison(ISearchComparison::COMPARE_GREATER_THAN, 'fileid', $cursor),
		]);
	}
}
