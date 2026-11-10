<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A move or probe request is malformed: no file of it is touched. */
final class InvalidMoveRequestException extends \InvalidArgumentException {
}
