<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\FileIds;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Reason;
use OCA\Honeycomb\Domain\StatsMetric;

/** Parses the bodies of the sidecar endpoints; a malformed body throws before anything is touched (ADR 0017). */
final class SidecarRequest {
	/** The counts a sidecar item may carry (STATS-001.36). */
	private const array COUNTS = [StatsMetric::RatingsSet, StatsMetric::ColourLabelsSet, StatsMetric::TagsSet];

	/**
	 * @param array<array-key, mixed> $fileIds
	 * @return list<int>
	 * @throws InvalidRequestException
	 */
	public static function fileIds(array $fileIds): array {
		$parsed = FileIds::parse($fileIds, SidecarLimits::MAX_ITEMS);
		return FileIds::eachOnce($parsed);
	}

	/**
	 * @param array<array-key, mixed> $sidecars
	 * @return list<ExistingSidecar|NewSidecar>
	 * @throws InvalidRequestException
	 */
	public static function sidecars(array $sidecars): array {
		$parsed = array_map(self::sidecar(...), FileIds::items($sidecars, SidecarLimits::MAX_ITEMS));
		self::checkUnique(array_map(static fn (ExistingSidecar|NewSidecar $sidecar): int|string => $sidecar instanceof NewSidecar ? $sidecar->path : $sidecar->fileId, $parsed));
		return $parsed;
	}

	/** @throws InvalidRequestException */
	private static function sidecar(mixed $sidecar): ExistingSidecar|NewSidecar {
		if (!is_array($sidecar) || array_is_list($sidecar)) {
			throw InvalidRequestException::because(Reason::NotAnObject, 'Each sidecar must be an object');
		}
		$bytes = self::bytes($sidecar['content'] ?? null);
		$counts = StatsItemCounts::parse($sidecar['counts'] ?? null, self::COUNTS);
		if (isset($sidecar['fileId']) === isset($sidecar['path'])) {
			throw InvalidRequestException::because(Reason::Conflict, 'Each sidecar names either a file id or a path');
		}
		if (isset($sidecar['path'])) {
			return new NewSidecar(self::path($sidecar['path']), $bytes, $counts);
		}
		['fileId' => $fileId, 'etag' => $etag, 'size' => $size, 'foreign' => $foreign] = $sidecar + ['etag' => null, 'size' => null, 'foreign' => false];
		if (!is_int($fileId) || $fileId < 1 || !is_string($etag) || $etag === '' || !is_int($size) || $size < 0 || !is_bool($foreign)) {
			throw InvalidRequestException::because(Reason::BadValue, 'An existing sidecar needs its file id, ETag and size, and foreign is true or false');
		}
		return new ExistingSidecar($fileId, $etag, $size, $bytes, $counts, $foreign);
	}

	/** @throws InvalidRequestException */
	private static function bytes(mixed $content): string {
		$bytes = is_string($content) ? base64_decode($content, true) : false;
		if ($bytes === false) {
			throw InvalidRequestException::because(Reason::BadValue, 'The content must be base64');
		}
		if (strlen($bytes) > SidecarLimits::MAX_BYTES) {
			throw InvalidRequestException::because(Reason::TooLarge, 'The content must be at most ' . SidecarLimits::MAX_BYTES . ' bytes');
		}
		return $bytes;
	}

	/**
	 * @return non-empty-string
	 * @throws InvalidRequestException
	 */
	private static function path(mixed $path): string {
		if (!is_string($path) || $path === '' || !str_starts_with($path, '/') || str_contains($path, "\0")
			|| in_array('..', explode('/', $path), true) || preg_match('/\/[^\/]+\.xmp$/i', $path) !== 1) {
			throw InvalidRequestException::because(Reason::BadPath, 'A new sidecar\'s path must be absolute and name an image plus .xmp');
		}
		return $path;
	}

	/**
	 * @param list<int|string> $keys
	 * @throws InvalidRequestException
	 */
	private static function checkUnique(array $keys): void {
		if (count(array_unique($keys)) !== count($keys)) {
			throw InvalidRequestException::because(Reason::Duplicate, 'A sidecar is named twice');
		}
	}
}
