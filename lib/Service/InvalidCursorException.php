<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The cursor of a page of a folder walk (missing visual hashes, orphaned sidecars) is no path relative to the folder. */
final class InvalidCursorException extends InvalidRequestException {
}
