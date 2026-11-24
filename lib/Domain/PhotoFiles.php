<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

use OCP\Files\File;

/** Which files honeycomb lists: photos and their XMP sidecars. */
final class PhotoFiles {
	/** Whether the listing lists a file of this type: a photo or an XMP sidecar. */
	public static function isListedType(File $file): bool {
		return self::isPhoto($file) || self::isSidecar($file);
	}

	/** Whether the file is an image, including RAW files Nextcloud does not type. */
	public static function isPhoto(File $file): bool {
		return str_starts_with($file->getMimetype(), 'image/') || UntypedRaw::isNamed($file->getName());
	}

	/** Whether the file is an XMP sidecar. */
	public static function isSidecar(File $file): bool {
		return str_ends_with(strtolower($file->getName()), '.xmp');
	}
}
