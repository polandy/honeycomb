<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\Config\IUserConfig;
use OCP\IUser;

/** Keeps each user's view state as one bool per key, null while never stored (ADR 0019). */
final class ViewStateService {
	/** The keys of the view state. */
	public const array KEYS = ['infoPanelOpen', 'gestureGuideSeen', 'seriesHintSeen'];

	public function __construct(
		private IUserConfig $config,
	) {
	}

	/**
	 * Every key with its stored boolean, null for a key never stored.
	 * @return array<string, ?bool>
	 */
	public function get(IUser $user): array {
		$state = [];
		foreach (self::KEYS as $key) {
			$state[$key] = $this->config->hasKey($user->getUID(), Application::APP_ID, $key)
				? $this->config->getValueBool($user->getUID(), Application::APP_ID, $key)
				: null;
		}
		return $state;
	}

	/**
	 * Stores the keys given and returns the whole view state.
	 * @throws InvalidViewStateException for anything but a non-empty object of known keys with boolean values
	 * @return array<string, ?bool>
	 */
	public function save(IUser $user, mixed $viewState): array {
		if (!is_array($viewState) || $viewState === []) {
			throw new InvalidViewStateException('viewState must be an object with at least one key');
		}
		foreach ($viewState as $key => $value) {
			if (!in_array($key, self::KEYS, true) || !is_bool($value)) {
				throw new InvalidViewStateException('viewState takes only ' . implode(', ', self::KEYS) . ', each a boolean');
			}
		}
		/** @var array<string, bool> $viewState */
		foreach ($viewState as $key => $value) {
			$this->config->setValueBool($user->getUID(), Application::APP_ID, $key, $value);
		}
		return $this->get($user);
	}
}
