<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\OrphanedSidecarRule;
use OCA\Honeycomb\Domain\Reason;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\IUser;

/** Pages through the orphaned sidecars below a folder, folder by folder in name order from a folder cursor (XMP-009, ADR 0047). */
final class OrphanedSidecarScan {
	/** Files looked at per page; a page ends after the folder in which it reaches them. */
	public const int PAGE_SIZE = 1_000;

	public function __construct(
		private UserFolderResolver $folders,
		private int $pageSize = self::PAGE_SIZE,
	) {
	}

	/**
	 * The orphaned sidecars of the folders after `$after`, the path of the last folder of the page before relative to `$path` (`/` for the folder itself).
	 * @return array{sidecars: list<array{fileId: int, etag: string, path: string, size: int}>, nextCursor: ?string}
	 * @throws FolderNotFoundException for a path that is not the user's folder
	 * @throws FolderNotReadableException when the user may not read the folder
	 * @throws InvalidRequestException for a cursor that is no folder path
	 */
	public function page(IUser $user, string $path, string $after): array {
		$cursor = self::cursorOf($after);
		$folder = $this->folders->folder($user, $path);
		if (!OrphanedSidecarRule::isOwnStorage($folder)) {
			return ['sidecars' => [], 'nextCursor' => null];
		}
		$base = rtrim((string)$this->folders->userFolder($user)->getRelativePath($folder->getPath()), '/');
		$sidecars = [];
		$looked = 0;
		foreach (self::walk($folder, '', $cursor) as $relative => [$files, $orphans]) {
			foreach ($orphans as $orphan) {
				$sidecars[] = ['fileId' => $orphan->getId(), 'etag' => $orphan->getEtag(), 'path' => $base . $relative . '/' . $orphan->getName(), 'size' => (int)$orphan->getSize()];
			}
			$looked += $files;
			if ($looked >= $this->pageSize) {
				return ['sidecars' => $sidecars, 'nextCursor' => $relative === '' ? '/' : $relative];
			}
		}
		return ['sidecars' => $sidecars, 'nextCursor' => null];
	}

	/**
	 * Each folder from `$folder` down, depth first in name order, by its path relative to the chosen folder, with its count of files and its orphaned sidecars;
	 * with a cursor, the folders up to it are skipped, its own files included.
	 * @param ?list<string> $after the cursor's segments below `$folder`, null when the folder is after the cursor
	 * @return \Generator<string, array{int, list<File>}>
	 */
	private static function walk(Folder $folder, string $relative, ?array $after): \Generator {
		$nodes = $folder->getDirectoryListing();
		if ($after === null) {
			$orphans = OrphanedSidecarRule::orphans($nodes);
			usort($orphans, static fn (File $a, File $b): int => strcmp($a->getName(), $b->getName()));
			yield $relative => [count(array_filter($nodes, static fn (Node $node): bool => $node instanceof File)), $orphans];
		}
		$first = $after[0] ?? null;
		$subfolders = array_filter($nodes, static fn (Node $node): bool => $node instanceof Folder && !str_starts_with($node->getName(), '.') && $node->isReadable() && OrphanedSidecarRule::isOwnStorage($node));
		usort($subfolders, static fn (Node $a, Node $b): int => strcmp($a->getName(), $b->getName()));
		foreach ($subfolders as $subfolder) {
			$name = $subfolder->getName();
			if ($first === null || strcmp($name, $first) > 0) {
				yield from self::walk($subfolder, $relative . '/' . $name, null);
			} elseif ($name === $first) {
				yield from self::walk($subfolder, $relative . '/' . $name, array_slice($after ?? [], 1));
			}
		}
	}

	/**
	 * The segments of a cursor; null for the first page, empty for the chosen folder itself.
	 * @return ?list<string>
	 * @throws InvalidRequestException
	 */
	private static function cursorOf(string $after): ?array {
		if ($after === '') {
			return null;
		}
		if ($after === '/') {
			return [];
		}
		$segments = explode('/', $after);
		if (array_shift($segments) !== '') {
			throw InvalidRequestException::because(Reason::BadCursor, $after);
		}
		foreach ($segments as $segment) {
			if (in_array($segment, ['', '.', '..'], true) || str_contains($segment, "\0")) {
				throw InvalidRequestException::because(Reason::BadCursor, $after);
			}
		}
		return $segments;
	}
}
