<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** No image file with this id lies in the user's files, or it has no preview. */
final class ImageNotFoundException extends \RuntimeException {
}
