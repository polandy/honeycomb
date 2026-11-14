<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

// The app's loader first, so the server's loader, registered after it, wins for the real OCP classes.
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../../../lib/base.php';
