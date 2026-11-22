<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A library request named a root outside the user's own storage, or a malformed page (FOLDERS-005.13, FOLDERS-005.14). */
final class InvalidLibraryRequestException extends InvalidRequestException {
}
