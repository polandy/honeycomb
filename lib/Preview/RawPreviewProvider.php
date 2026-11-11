<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Preview;

use OCP\Files\File;
use OCP\Files\FileInfo;
use OCP\Files\NotPermittedException;
use OCP\IImage;
use OCP\Lock\LockedException;
use OCP\Preview\IProviderV2;

/** Previews a RAW file by the largest JPEG it embeds (ADR 0010). */
final class RawPreviewProvider implements IProviderV2 {
	/** Nextcloud's mime type for camera RAW files, and the one it gives RAW files it does not type. */
	public const string MIME_TYPE_REGEX = '/^(image\/x-dcraw|application\/octet-stream)$/';
	private const string RAW = 'image/x-dcraw';

	public function __construct(
		private EmbeddedJpeg $embeddedJpeg,
		private JpegDecoder $decoder,
	) {
	}

	#[\Override]
	public function getMimeType(): string {
		return self::MIME_TYPE_REGEX;
	}

	#[\Override]
	public function isAvailable(FileInfo $file): bool {
		return $file->getSize() > 0 && ($file->getMimetype() === self::RAW || UntypedRaw::isNamed($file->getName()));
	}

	#[\Override]
	public function getThumbnail(File $file, int $maxX, int $maxY): ?IImage {
		try {
			$jpeg = $this->embeddedJpeg->largest($file->getContent());
		} catch (NotPermittedException|LockedException) {
			return null;
		}
		$image = $jpeg === null ? null : $this->decoder->decode($jpeg);
		$image?->scaleDownToFit($maxX, $maxY);
		return $image;
	}
}
