<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** One of digiKam's nine colour labels (Q5); the values are the wire and storage form (ADR 0012). */
enum ColourLabel: string {
	case Red = 'red';
	case Orange = 'orange';
	case Yellow = 'yellow';
	case Green = 'green';
	case Blue = 'blue';
	case Magenta = 'magenta';
	case Gray = 'gray';
	case Black = 'black';
	case White = 'white';
}
