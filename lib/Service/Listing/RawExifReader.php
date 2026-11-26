<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Listing;

use DateTimeZone;
use OCP\Files\File;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Reads the RAW exif value of a file from its first MiB, sequentially through `OCP\Files` (ADR 0061). */
final class RawExifReader {
	/** The bytes read from the start of a file; a value beyond them counts as absent. */
	public const int READ_LIMIT = 1 << 20;

	public function __construct(
		private RawHeaderParser $parser,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * The file's RAW exif value with the time in `$zone` when its header has no offset, null when its stream fails.
	 * @return ?array{DateTimeOriginal?: int, Make?: string, Model?: string}
	 */
	public function read(File $file, DateTimeZone $zone): ?array {
		try {
			$handle = $file->fopen('r');
		} catch (NotPermittedException|LockedException $exception) {
			$this->logger->warning('Could not open the RAW file {fileId} to read its header', ['fileId' => $file->getId(), 'exception' => $exception]);
			return null;
		}
		if (!is_resource($handle)) {
			$this->logger->warning('Could not open the RAW file {fileId} to read its header', ['fileId' => $file->getId()]);
			return null;
		}
		try {
			$bytes = stream_get_contents($handle, self::READ_LIMIT);
		} finally {
			fclose($handle);
		}
		if ($bytes === false) {
			$this->logger->warning('Could not read the header of the RAW file {fileId}', ['fileId' => $file->getId()]);
			return null;
		}
		return RawExif::of($this->parser->fields($bytes), $zone);
	}
}
