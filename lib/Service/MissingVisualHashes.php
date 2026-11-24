<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\Node;
use OCP\IUser;

/**
 * Pages through the user's own photos below a folder that have no visual hash of their current
 * etag and the client's method, walking the tree in name order from a path cursor (ADR 0025).
 */
final class MissingVisualHashes {
	/** Photos looked at per page; a page lists only those of them without a current hash. */
	public const int PAGE_SIZE = 500;

	/** The mount type of the user's home storage; shares, group folders and external storage differ. */
	private const string OWN_MOUNT = '';

	public function __construct(
		private UserFolderResolver $folders,
		private VisualHashStore $store,
		private int $pageSize = self::PAGE_SIZE,
	) {
	}

	/**
	 * The next page of photos without a current hash of `$method` after `$after`, a path relative to `$path`.
	 * @return array{pictures: list<array{fileId: int, etag: string, mtime: int, path: string}>, nextCursor: ?string}
	 * @throws FolderNotFoundException for a path that is not the user's folder
	 * @throws FolderNotReadableException when the user may not read the folder
	 * @throws InvalidRequestException for a cursor that is no relative path
	 * @throws InvalidRequestException for a method outside 1 to VisualHash::MAX_METHOD
	 */
	public function page(IUser $user, string $path, string $after, int $method): array {
		if ($method < 1 || $method > VisualHash::MAX_METHOD) {
			throw InvalidRequestException::because(Reason::BadValue, 'method must be an integer from 1 to ' . VisualHash::MAX_METHOD . ", not $method");
		}
		$cursor = self::cursorOf($after);
		$folder = $this->folders->folder($user, $path);
		if (!$this->isOwn($folder)) {
			return ['pictures' => [], 'nextCursor' => null];
		}
		$base = rtrim((string)$this->folders->userFolder($user)->getRelativePath($folder->getPath()), '/');
		$photos = [];
		$last = null;
		foreach ($this->walk($folder, '', $cursor) as $relative => $photo) {
			$photos[$relative] = $photo;
			$last = $relative;
			if (count($photos) === $this->pageSize) {
				break;
			}
		}
		$stored = $this->store->find(array_values(array_map(static fn (File $photo): int => $photo->getId(), $photos)));
		$pictures = [];
		foreach ($photos as $relative => $photo) {
			$fileId = $photo->getId();
			$hash = $stored[$fileId] ?? null;
			if ($hash?->etag !== $photo->getEtag() || $hash?->method !== $method) {
				$pictures[] = ['fileId' => $fileId, 'etag' => $photo->getEtag(), 'mtime' => $photo->getMTime(), 'path' => $base . '/' . $relative];
			}
		}
		return ['pictures' => $pictures, 'nextCursor' => count($photos) === $this->pageSize ? $last : null];
	}

	/**
	 * The photos below `$folder` by path relative to the chosen folder, in name order, after the
	 * cursor's segments; folders before the cursor are skipped without being listed.
	 * @param list<string> $after
	 * @return \Generator<string, File>
	 */
	private function walk(Folder $folder, string $prefix, array $after): \Generator {
		$first = $after[0] ?? null;
		$nodes = $folder->getDirectoryListing();
		usort($nodes, static fn (Node $a, Node $b): int => strcmp($a->getName(), $b->getName()));
		foreach ($nodes as $node) {
			$name = $node->getName();
			if ($first !== null && strcmp($name, $first) < 0) {
				continue;
			}
			if ($node instanceof Folder) {
				if ($this->isOwn($node) && !str_starts_with($name, '.') && $node->isReadable()) {
					yield from $this->walk($node, $prefix . $name . '/', $name === $first ? array_slice($after, 1) : []);
				}
			} elseif ($node instanceof File && $name !== $first && ListingService::isPhoto($node)) {
				yield $prefix . $name => $node;
			}
		}
	}

	private function isOwn(Folder $folder): bool {
		return $folder->getMountPoint()->getMountType() === self::OWN_MOUNT;
	}

	/**
	 * The segments of a cursor; empty for the first page.
	 * @return list<string>
	 * @throws InvalidRequestException
	 */
	private static function cursorOf(string $after): array {
		if ($after === '') {
			return [];
		}
		$segments = explode('/', $after);
		foreach ($segments as $segment) {
			if (in_array($segment, ['', '.', '..'], true) || str_contains($segment, "\0")) {
				throw InvalidRequestException::because(Reason::BadCursor, $after);
			}
		}
		return $segments;
	}
}
