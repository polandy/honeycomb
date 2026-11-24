<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Node;

/** Tells which sidecars of a folder have no photo or video of their own there (XMP-009, ADR 0047). */
final class OrphanedSidecarRule {
	/** darktable names a duplicate's sidecar `IMG_0001_01.NEF.xmp` (`docs/dev/06-xmp-interop.md`). */
	private const string DARKTABLE_DUPLICATE = '/^(.+)_\d+(\.[^.]+)$/';

	private const string SIDECAR_SUFFIX = '.xmp';

	/** The mount type of the user's home storage; shares, group folders and external storage differ. */
	private const string OWN_MOUNT = '';

	/** Whether the node lies on the user's own storage, the only one cleaned up. */
	public static function isOwnStorage(Node $node): bool {
		return $node->getMountPoint()->getMountType() === self::OWN_MOUNT;
	}

	/**
	 * The sidecars among one folder's nodes that no media file among them owns.
	 * @param iterable<Node> $nodes
	 * @return list<File>
	 */
	public static function orphans(iterable $nodes): array {
		$sidecars = [];
		$media = [];
		foreach ($nodes as $node) {
			if (!$node instanceof File) {
				continue;
			}
			if (PhotoFiles::isSidecar($node)) {
				$sidecars[$node->getName()] = $node;
			} elseif (self::isMedia($node)) {
				$media[] = $node->getName();
			}
		}
		return array_values(array_intersect_key($sidecars, array_flip(self::orphanNames($media, array_keys($sidecars)))));
	}

	/**
	 * The sidecar names that no media file name owns, all from one folder.
	 * @param list<string> $media photo and video file names
	 * @param list<string> $sidecars
	 * @return list<string>
	 */
	public static function orphanNames(array $media, array $sidecars): array {
		$owners = [];
		foreach ($media as $name) {
			$name = strtolower($name);
			$owners[$name] = true;
			$owners[pathinfo($name, PATHINFO_FILENAME)] = true;
		}
		return array_values(array_filter($sidecars, static fn (string $sidecar): bool => !self::isOwned($sidecar, $owners)));
	}

	/** Whether the file is a video, which owns sidecars but is no picture. */
	public static function isVideo(File $file): bool {
		return str_starts_with($file->getMimetype(), 'video/');
	}

	/**
	 * Whether no media file among the folder's nodes owns `$sidecar`.
	 * @param iterable<Node> $nodes
	 */
	public static function isOrphan(File $sidecar, iterable $nodes): bool {
		$id = $sidecar->getId();
		foreach (self::orphans($nodes) as $orphan) {
			if ($orphan->getId() === $id) {
				return true;
			}
		}
		return false;
	}

	/** A photo, including untyped RAW files, or a video. */
	private static function isMedia(File $file): bool {
		return PhotoFiles::isPhoto($file) || self::isVideo($file);
	}

	/** @param array<string, true> $owners media file names and their names without the extension, in lower case */
	private static function isOwned(string $sidecarName, array $owners): bool {
		$stem = strtolower(substr($sidecarName, 0, -strlen(self::SIDECAR_SUFFIX)));
		return isset($owners[$stem]) || isset($owners[(string)preg_replace(self::DARKTABLE_DUPLICATE, '$1$2', $stem)]);
	}
}
