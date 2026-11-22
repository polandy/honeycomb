<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\FilesMetadata\Exceptions\FilesMetadataException;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\FilesMetadata\Model\IFilesMetadata;

/** Reads the capture times of files from Nextcloud's file metadata, in batches. */
final class CaptureTimes {
	/** The key the Photos app's metadata provider writes the capture time under. */
	public const string KEY = 'photos-original_date_time';
	/** File ids per metadata request. */
	private const int BATCH = 1_000;

	public function __construct(
		private IFilesMetadataManager $metadataManager,
	) {
	}

	/**
	 * The capture times of those `$fileIds` that have one, by file id.
	 * @param list<int> $fileIds
	 * @return array<int, int>
	 */
	public function of(array $fileIds): array {
		$times = [];
		foreach (array_chunk($fileIds, self::BATCH) as $chunk) {
			foreach ($this->metadataManager->getMetadataForFiles($chunk) as $fileId => $metadata) {
				$time = self::from($metadata);
				if ($time !== null) {
					$times[(int)$fileId] = $time;
				}
			}
		}
		return $times;
	}

	/** The capture time in `$metadata`, null without one. */
	public static function from(?IFilesMetadata $metadata): ?int {
		try {
			return $metadata?->getInt(self::KEY);
		} catch (FilesMetadataException) {
			return null;
		}
	}
}
