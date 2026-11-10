<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Preview;

use OCP\IImage;

/** Decodes JPEG bytes into an image Nextcloud's preview system can scale and store. */
interface JpegDecoder {
	/** The decoded image, upright by its own orientation tag, or null when the bytes do not decode. */
	public function decode(string $jpeg): ?IImage;
}
