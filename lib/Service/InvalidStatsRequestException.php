<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** A statistics request names a malformed day or a period that ends before it starts. */
final class InvalidStatsRequestException extends InvalidRequestException {
}
