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

	/**
	 * The sidecars among one folder's nodes that no media file among them owns.
	 * @param iterable<Node> $nodes
	 * @return list<File>
	 */
	public static function orphans(iterable $nodes): array {
		$sidecars = [];
		$owners = [];
		foreach ($nodes as $node) {
			if (!$node instanceof File) {
				continue;
			}
			if (ListingService::isSidecar($node)) {
				$sidecars[] = $node;
			} elseif (self::isMedia($node)) {
				$name = strtolower($node->getName());
				$owners[$name] = true;
				$owners[pathinfo($name, PATHINFO_FILENAME)] = true;
			}
		}
		return array_values(array_filter($sidecars, static fn (File $sidecar): bool => !self::isOwned($sidecar->getName(), $owners)));
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
		return ListingService::isPhoto($file) || str_starts_with($file->getMimetype(), 'video/');
	}

	/** @param array<string, true> $owners media file names and their names without the extension, in lower case */
	private static function isOwned(string $sidecarName, array $owners): bool {
		$stem = strtolower(substr($sidecarName, 0, -strlen(self::SIDECAR_SUFFIX)));
		return isset($owners[$stem]) || isset($owners[(string)preg_replace(self::DARKTABLE_DUPLICATE, '$1$2', $stem)]);
	}
}
