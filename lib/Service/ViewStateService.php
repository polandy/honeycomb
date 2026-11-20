<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\Config\IUserConfig;
use OCP\IUser;

/** Keeps each user's view state as one bool per key and one year, null while never stored (ADR 0019). */
final class ViewStateService {
	/** The keys of the view state. */
	public const array KEYS = ['infoPanelOpen', 'gestureGuideSeen', 'seriesHintSeen'];

	/** The key that holds a year instead of a boolean. */
	public const string YEAR_KEY = 'yearReviewHintClosed';

	private const int FIRST_YEAR = 1970;
	private const int LAST_YEAR = 9999;

	public function __construct(
		private IUserConfig $config,
	) {
	}

	/**
	 * Every key with its stored boolean or year, null for a key never stored.
	 * @return array<string, bool|int|null>
	 */
	public function get(IUser $user): array {
		$state = [];
		foreach (self::KEYS as $key) {
			$state[$key] = $this->config->hasKey($user->getUID(), Application::APP_ID, $key)
				? $this->config->getValueBool($user->getUID(), Application::APP_ID, $key)
				: null;
		}
		$state[self::YEAR_KEY] = $this->config->hasKey($user->getUID(), Application::APP_ID, self::YEAR_KEY)
			? $this->config->getValueInt($user->getUID(), Application::APP_ID, self::YEAR_KEY)
			: null;
		return $state;
	}

	/**
	 * Stores the keys given and returns the whole view state.
	 * @throws InvalidViewStateException for anything but a non-empty object of known keys with boolean values, or a year for the year key
	 * @return array<string, bool|int|null>
	 */
	public function save(IUser $user, mixed $viewState): array {
		if (!is_array($viewState) || $viewState === []) {
			throw new InvalidViewStateException('viewState must be an object with at least one key');
		}
		/** @var array<string, bool|int> $valid */
		$valid = array_filter($viewState, fn (mixed $value, int|string $key): bool => $this->isValid($key, $value), ARRAY_FILTER_USE_BOTH);
		if (count($valid) !== count($viewState)) {
			throw new InvalidViewStateException('viewState takes only ' . implode(', ', self::KEYS) . ', each a boolean, and ' . self::YEAR_KEY . ', a year');
		}
		foreach ($valid as $key => $value) {
			if (is_int($value)) {
				$this->config->setValueInt($user->getUID(), Application::APP_ID, $key, $value);
			} else {
				$this->config->setValueBool($user->getUID(), Application::APP_ID, $key, $value);
			}
		}
		return $this->get($user);
	}

	private function isValid(int|string $key, mixed $value): bool {
		if ($key === self::YEAR_KEY) {
			return is_int($value) && $value >= self::FIRST_YEAR && $value <= self::LAST_YEAR;
		}
		return in_array($key, self::KEYS, true) && is_bool($value);
	}
}
