<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The most files one move or trash request carries, so it ends well inside a timeout (ADR 0029). */
final class PictureRequestLimit {
	public const int FILES = 500;
}
