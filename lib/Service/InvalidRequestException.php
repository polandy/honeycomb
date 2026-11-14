<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/**
 * A request is malformed: nothing of it is written; each kind of request has its own subclass.
 * @psalm-consistent-constructor
 */
abstract class InvalidRequestException extends \InvalidArgumentException {
}
