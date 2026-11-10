<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The trash bin app is off for the user, so deleting would not be restorable (ADR 0013). */
final class TrashBinDisabledException extends \RuntimeException {
}
