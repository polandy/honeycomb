<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** The connections file breaks its shape; the message names the violation for the log only. */
final class ConnectionsFileViolation extends \RuntimeException {
}
