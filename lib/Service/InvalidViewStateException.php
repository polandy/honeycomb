<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use InvalidArgumentException;

/** The view state is not an object of known keys with boolean values (ADR 0019). */
final class InvalidViewStateException extends InvalidArgumentException {
}
