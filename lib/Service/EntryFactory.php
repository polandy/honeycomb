<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\QualityValue;
use OCA\Honeycomb\Domain\Store\FlagStore;
use OCA\Honeycomb\Domain\Store\QualityStore;
use OCA\Honeycomb\Domain\Store\VisualHashStore;
use OCA\Honeycomb\Domain\VisualHash;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\FilesMetadata\Exceptions\FilesMetadataException;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\FilesMetadata\Model\IFilesMetadata;

/** Turns files into entries, reading their EXIF basics from Nextcloud's file metadata. */
final class EntryFactory {
	// Keys written by the Photos app's metadata providers.
	private const SIZE = 'photos-size';
	private const IFD0 = 'photos-ifd0';
	private const EXIF = 'photos-exif';

	public function __construct(
		private IFilesMetadataManager $metadataManager,
		private VisualHashStore $visualHashes,
		private FlagStore $flags,
		private QualityStore $quality,
	) {
	}

	/**
	 * Entries of `$files` with paths relative to `$userFolder`, from one metadata, one visual hash, one flag and one quality query.
	 * @param list<File> $files
	 * @return list<Entry>
	 */
	public function create(Folder $userFolder, array $files): array {
		if ($files === []) {
			return [];
		}
		$fileIds = array_map(static fn (File $file): int => $file->getId(), $files);
		$metadata = $this->metadataManager->getMetadataForFiles($fileIds);
		$hashes = $this->visualHashes->find($fileIds);
		$flags = $this->flags->find($fileIds);
		$quality = $this->quality->find($fileIds);
		return array_map(
			fn (File $file): Entry => $this->entry($userFolder, $file, $metadata[$file->getId()] ?? null, $hashes[$file->getId()] ?? null, $flags[$file->getId()] ?? null, $quality[$file->getId()] ?? null),
			$files,
		);
	}

	/** A stored hash or quality value counts only while the file is at the etag it was taken from (ADR 0024, ADR 0046). */
	private function entry(Folder $userFolder, File $file, ?IFilesMetadata $metadata, ?VisualHash $hash, ?FileFlag $flag, ?QualityValue $quality): Entry {
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
			CaptureTimes::from($metadata),
			self::intOrNull($ifd0['Orientation'] ?? null),
			$complete ? $width : null,
			$complete ? $height : null,
			self::camera($ifd0),
			$hash !== null && $hash->etag === $file->getEtag() ? $hash : null,
			$quality !== null && $quality->etag === $file->getEtag() ? $quality : null,
			Exposure::fromExif($this->arrayOf($metadata, self::EXIF)),
			$flag,
		);
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
