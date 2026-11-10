<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Parses the bodies of the sidecar endpoints; a malformed body throws before anything is touched (ADR 0017). */
final class SidecarRequest {
	/**
	 * @param array<array-key, mixed> $fileIds
	 * @return list<positive-int>
	 * @throws InvalidSidecarRequestException
	 */
	public static function fileIds(array $fileIds): array {
		self::checkList($fileIds);
		foreach ($fileIds as $fileId) {
			if (!is_int($fileId) || $fileId < 1) {
				throw new InvalidSidecarRequestException('Each file id must be a positive integer');
			}
		}
		/** @var list<positive-int> $fileIds */
		self::checkUnique($fileIds);
		return $fileIds;
	}

	/**
	 * @param array<array-key, mixed> $sidecars
	 * @return list<ExistingSidecar|NewSidecar>
	 * @throws InvalidSidecarRequestException
	 */
	public static function sidecars(array $sidecars): array {
		self::checkList($sidecars);
		$parsed = array_values(array_map(self::sidecar(...), $sidecars));
		self::checkUnique(array_map(static fn (ExistingSidecar|NewSidecar $sidecar): int|string => $sidecar instanceof NewSidecar ? $sidecar->path : $sidecar->fileId, $parsed));
		return $parsed;
	}

	/** @throws InvalidSidecarRequestException */
	private static function sidecar(mixed $sidecar): ExistingSidecar|NewSidecar {
		if (!is_array($sidecar) || array_is_list($sidecar)) {
			throw new InvalidSidecarRequestException('Each sidecar must be an object');
		}
		$bytes = self::bytes($sidecar['content'] ?? null);
		if (isset($sidecar['fileId']) === isset($sidecar['path'])) {
			throw new InvalidSidecarRequestException('Each sidecar names either a file id or a path');
		}
		if (isset($sidecar['path'])) {
			return new NewSidecar(self::path($sidecar['path']), $bytes);
		}
		['fileId' => $fileId, 'etag' => $etag, 'size' => $size] = $sidecar + ['etag' => null, 'size' => null];
		if (!is_int($fileId) || $fileId < 1 || !is_string($etag) || $etag === '' || !is_int($size) || $size < 0) {
			throw new InvalidSidecarRequestException('An existing sidecar needs its file id, ETag and size');
		}
		return new ExistingSidecar($fileId, $etag, $size, $bytes);
	}

	/** @throws InvalidSidecarRequestException */
	private static function bytes(mixed $content): string {
		$bytes = is_string($content) ? base64_decode($content, true) : false;
		if ($bytes === false || strlen($bytes) > SidecarLimits::MAX_BYTES) {
			throw new InvalidSidecarRequestException('The content must be base64 of at most ' . SidecarLimits::MAX_BYTES . ' bytes');
		}
		return $bytes;
	}

	/**
	 * @return non-empty-string
	 * @throws InvalidSidecarRequestException
	 */
	private static function path(mixed $path): string {
		if (!is_string($path) || $path === '' || !str_starts_with($path, '/') || str_contains($path, "\0")
			|| in_array('..', explode('/', $path), true) || preg_match('/\/[^\/]+\.xmp$/i', $path) !== 1) {
			throw new InvalidSidecarRequestException('A new sidecar\'s path must be absolute and name an image plus .xmp');
		}
		return $path;
	}

	/**
	 * @param array<array-key, mixed> $items
	 * @throws InvalidSidecarRequestException
	 */
	private static function checkList(array $items): void {
		if (!array_is_list($items) || count($items) > SidecarLimits::MAX_ITEMS) {
			throw new InvalidSidecarRequestException('The request must be a list of at most ' . SidecarLimits::MAX_ITEMS . ' items');
		}
	}

	/**
	 * @param list<int|string> $keys
	 * @throws InvalidSidecarRequestException
	 */
	private static function checkUnique(array $keys): void {
		if (count(array_unique($keys)) !== count($keys)) {
			throw new InvalidSidecarRequestException('A sidecar is named twice');
		}
	}
}
