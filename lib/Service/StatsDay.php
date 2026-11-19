<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\IUser;

/** Today in the user's Nextcloud time zone, UTC without a known one (ADR 0039). */
final readonly class StatsDay {
	/** The day format of every counter. */
	public const string FORMAT = 'Y-m-d';
	private const string FALLBACK_ZONE = 'UTC';

	public function __construct(
		private IUserConfig $config,
		private ITimeFactory $time,
	) {
	}

	/** Today as `YYYY-MM-DD` for the user. */
	public function today(IUser $user): string {
		return $this->time->getDateTime('now', $this->zone($user))->format(self::FORMAT);
	}

	private function zone(IUser $user): \DateTimeZone {
		$name = $this->config->getValueString($user->getUID(), 'core', 'timezone', '');
		return new \DateTimeZone(in_array($name, \DateTimeZone::listIdentifiers(), true) && $name !== '' ? $name : self::FALLBACK_ZONE);
	}
}
