<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\Config\IUserConfig;
use OCP\IUser;
use stdClass;

/** Keeps each user's settings as one JSON object; the client checks every field (ADR 0014). */
final class SettingsService {
	/** The largest encoded settings object that is stored. */
	public const int MAX_BYTES = 8192;

	private const string KEY = 'settings';

	public function __construct(
		private IUserConfig $config,
	) {
	}

	/** The stored settings, an empty object when none or no object is stored. */
	public function get(IUser $user): stdClass {
		/** @var mixed $stored */
		$stored = json_decode($this->config->getValueString($user->getUID(), Application::APP_ID, self::KEY, '{}'));
		return $stored instanceof stdClass ? $stored : new stdClass();
	}

	/**
	 * Stores the whole settings object and returns it as stored.
	 * @throws InvalidSettingsException for anything but an object, or one over MAX_BYTES encoded
	 */
	public function save(IUser $user, mixed $settings): stdClass {
		if (!is_array($settings) || ($settings !== [] && array_is_list($settings))) {
			throw new InvalidSettingsException('settings must be a JSON object');
		}
		$encoded = json_encode((object)$settings, JSON_THROW_ON_ERROR);
		if (strlen($encoded) > self::MAX_BYTES) {
			throw new InvalidSettingsException('settings must be at most ' . self::MAX_BYTES . ' bytes');
		}
		$this->config->setValueString($user->getUID(), Application::APP_ID, self::KEY, $encoded);
		return $this->get($user);
	}
}
