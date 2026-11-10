<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use InvalidArgumentException;

/** The settings are not a JSON object or are too large to store (ADR 0014). */
final class InvalidSettingsException extends InvalidArgumentException {
}
