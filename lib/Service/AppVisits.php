<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\Config\IUserConfig;
use OCP\IUser;

/** Remembers who has opened honeycomb, so photos are rendered ahead only for people who cull (ADR 0045). */
final class AppVisits {
	private const string OPENED = 'opened';

	public function __construct(
		private IUserConfig $config,
	) {
	}

	/** Records that the user opened honeycomb; writes only on the first visit. */
	public function record(IUser $user): void {
		if (!$this->opened($user->getUID())) {
			$this->config->setValueBool($user->getUID(), Application::APP_ID, self::OPENED, true);
		}
	}

	/** Whether the user has ever opened honeycomb. */
	public function opened(string $userId): bool {
		return $this->config->getValueBool($userId, Application::APP_ID, self::OPENED);
	}
}
