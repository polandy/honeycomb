<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Preview;

use OCP\IImage;
use OCP\Image;

/** Decodes with `OCP\Image`, which needs a running Nextcloud; the e2e case covers it. */
final class OcpJpegDecoder implements JpegDecoder {
	#[\Override]
	public function decode(string $jpeg): ?IImage {
		/**
		 * @var IImage $image
		 * @psalm-suppress MissingDependency `OC\Image` is server code outside the OCP stubs.
		 */
		$image = new Image();
		/** @psalm-suppress UndefinedClass `GdImage` is unknown where PHP runs without gd. */
		$image->loadFromData($jpeg);
		if (!$image->valid()) {
			return null;
		}
		$image->fixOrientation();
		return $image;
	}
}
