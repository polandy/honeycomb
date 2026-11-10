<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Reads the bodies of the move endpoints and refuses a malformed one whole (ADR 0018). */
final class MoveRequest {
	/**
	 * @param array<array-key, mixed> $pictures
	 * @return list<non-empty-list<MoveFile>>
	 * @throws InvalidMoveRequestException
	 */
	public static function pictures(array $pictures): array {
		if (!array_is_list($pictures)) {
			throw new InvalidMoveRequestException('pictures must be a list');
		}
		$parsed = array_map(self::picture(...), $pictures);
		$files = array_merge(...$parsed);
		if (count($files) > ListingService::ENTRY_LIMIT) {
			throw new InvalidMoveRequestException('At most ' . ListingService::ENTRY_LIMIT . ' files');
		}
		self::refuseTwice(array_map(static fn (MoveFile $file): int => $file->fileId, $files), 'file id');
		self::refuseTwice(array_map(static fn (MoveFile $file): string => mb_strtolower($file->path), $files), 'target path');
		$moved = array_flip(array_map(static fn (MoveFile $file): int => $file->fileId, $files));
		foreach ($files as $file) {
			if ($file->replaceFileId !== null && isset($moved[$file->replaceFileId])) {
				throw new InvalidMoveRequestException("File {$file->replaceFileId} is moved and replaced");
			}
		}
		return $parsed;
	}

	/**
	 * @param array<array-key, mixed> $folders
	 * @return list<string>
	 * @throws InvalidMoveRequestException
	 */
	public static function folders(array $folders): array {
		if (!array_is_list($folders) || count($folders) > ListingService::ENTRY_LIMIT) {
			throw new InvalidMoveRequestException('folders must be a list of at most ' . ListingService::ENTRY_LIMIT . ' paths');
		}
		return array_map(static fn (mixed $path): string => $path === '/' ? '/' : self::path($path), $folders);
	}

	/**
	 * @return non-empty-list<MoveFile>
	 * @throws InvalidMoveRequestException
	 */
	private static function picture(mixed $picture): array {
		if (!is_array($picture) || $picture === [] || !array_is_list($picture)) {
			throw new InvalidMoveRequestException('Each picture must be a non-empty list of files');
		}
		return array_map(self::file(...), $picture);
	}

	/** @throws InvalidMoveRequestException */
	private static function file(mixed $file): MoveFile {
		$file = is_array($file) ? $file : [];
		$fileId = $file['fileId'] ?? null;
		$etag = $file['etag'] ?? null;
		if (!is_int($fileId) || $fileId < 1 || !is_string($etag) || $etag === '') {
			throw new InvalidMoveRequestException('Each file must have a positive fileId and an etag');
		}
		$path = self::path($file['path'] ?? null);
		if (!array_key_exists('replace', $file)) {
			return new MoveFile($fileId, $etag, $path);
		}
		$replace = is_array($file['replace']) ? $file['replace'] : [];
		$replaceId = $replace['fileId'] ?? null;
		$replaceEtag = $replace['etag'] ?? null;
		if (!is_int($replaceId) || $replaceId < 1 || !is_string($replaceEtag) || $replaceEtag === '') {
			throw new InvalidMoveRequestException('A replace must have a positive fileId and an etag');
		}
		return new MoveFile($fileId, $etag, $path, $replaceId, $replaceEtag);
	}

	/**
	 * An absolute path below the user's files without empty, `.` or `..` segments.
	 * @throws InvalidMoveRequestException
	 */
	private static function path(mixed $path): string {
		if (!is_string($path) || !str_starts_with($path, '/') || str_contains($path, '\\') || str_contains($path, "\0")) {
			throw new InvalidMoveRequestException('A path must be absolute, without backslash or NUL');
		}
		foreach (explode('/', substr($path, 1)) as $segment) {
			if ($segment === '' || $segment === '.' || $segment === '..') {
				throw new InvalidMoveRequestException('A path must not have an empty, . or .. segment');
			}
		}
		return $path;
	}

	/**
	 * @param list<int|string> $keys
	 * @throws InvalidMoveRequestException
	 */
	private static function refuseTwice(array $keys, string $what): void {
		if (count($keys) !== count(array_unique($keys))) {
			throw new InvalidMoveRequestException("A $what is given twice");
		}
	}
}
