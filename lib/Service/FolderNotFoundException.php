<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The folder does not exist, is not a folder or lies outside the user's files. */
final class FolderNotFoundException extends \RuntimeException {
}
