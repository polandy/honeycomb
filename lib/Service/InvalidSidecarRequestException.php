<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A sidecar request is malformed: no file of it is read or written. */
final class InvalidSidecarRequestException extends \InvalidArgumentException {
}
