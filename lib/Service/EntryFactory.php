<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\FilesMetadata\Exceptions\FilesMetadataException;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\FilesMetadata\Model\IFilesMetadata;

/** Turns files into entries, reading their EXIF basics from Nextcloud's file metadata. */
final class EntryFactory {
	// Keys written by the Photos app's metadata providers.
	private const CAPTURE_TIME = 'photos-original_date_time';
	private const SIZE = 'photos-size';
	private const IFD0 = 'photos-ifd0';

	public function __construct(
		private IFilesMetadataManager $metadataManager,
		private VisualHashStore $visualHashes,
	) {
	}

	/**
	 * Entries of `$files` with paths relative to `$userFolder`, from one metadata and one visual hash query.
	 * @param list<File> $files
	 * @return list<Entry>
	 */
	public function create(string $userId, Folder $userFolder, array $files): array {
		if ($files === []) {
			return [];
		}
		$fileIds = array_map(static fn (File $file): int => $file->getId(), $files);
		$metadata = $this->metadataManager->getMetadataForFiles($fileIds);
		$hashes = $this->visualHashes->find($userId, $fileIds);
		return array_map(
			fn (File $file): Entry => $this->entry($userFolder, $file, $metadata[$file->getId()] ?? null, $hashes[$file->getId()] ?? null),
			$files,
		);
	}

	/** A stored hash counts only while the file is at the etag it was taken from (ADR 0024). */
	private function entry(Folder $userFolder, File $file, ?IFilesMetadata $metadata, ?VisualHash $hash): Entry {
		$size = $this->arrayOf($metadata, self::SIZE);
		$width = self::intOrNull($size['width'] ?? null);
		$height = self::intOrNull($size['height'] ?? null);
		$complete = $width !== null && $height !== null;
		$ifd0 = $this->arrayOf($metadata, self::IFD0);
		return new Entry(
			$file->getId(),
			(string)$userFolder->getRelativePath($file->getPath()),
			(int)$file->getSize(),
			$file->getMTime(),
			$file->getEtag(),
			$file->getMimetype(),
			$this->captureTime($metadata),
			self::intOrNull($ifd0['Orientation'] ?? null),
			$complete ? $width : null,
			$complete ? $height : null,
			self::camera($ifd0),
			$hash !== null && $hash->etag === $file->getEtag() ? $hash->hash : null,
		);
	}

	private function captureTime(?IFilesMetadata $metadata): ?int {
		try {
			return $metadata?->getInt(self::CAPTURE_TIME);
		} catch (FilesMetadataException) {
			return null;
		}
	}

	/** @return array<array-key, mixed> */
	private function arrayOf(?IFilesMetadata $metadata, string $key): array {
		try {
			return $metadata?->getArray($key) ?? [];
		} catch (FilesMetadataException) {
			return [];
		}
	}

	/** @param array<array-key, mixed> $ifd0 */
	private static function camera(array $ifd0): ?string {
		$parts = array_filter(
			array_map(static fn (mixed $part): string => is_string($part) ? trim($part) : '', [$ifd0['Make'] ?? null, $ifd0['Model'] ?? null]),
			static fn (string $part): bool => $part !== '',
		);
		return $parts === [] ? null : implode(' ', $parts);
	}

	private static function intOrNull(mixed $value): ?int {
		return is_int($value) || (is_string($value) && ctype_digit($value)) ? (int)$value : null;
	}
}
