<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Reason;
use OCA\Honeycomb\Immich\ConnectionsFileShape;
use OCP\Config\IUserConfig;
use OCP\IUser;

/** Keeps each user's view state as one bool per key, one year and the Immich filters per connection, null while never stored (ADR 0019). */
final class ViewStateService {
	/** The keys of the view state. */
	public const array KEYS = ['info_panel_open', 'gesture_guide_seen', 'series_hint_seen', 'reject_hint_seen'];

	/** The key that holds a year instead of a boolean. */
	public const string YEAR_KEY = 'year_review_hint_closed';

	/** The key that holds the Immich filters per connection id. */
	public const string IMMICH_FILTERS_KEY = 'immich_filters';

	private const int FIRST_YEAR = 1970;
	private const int LAST_YEAR = 9999;
	private const int MAX_FILTERS_BYTES = 4096;
	private const int MAX_CONNECTIONS = 50;

	public function __construct(
		private IUserConfig $config,
	) {
	}

	/**
	 * Every key with its stored boolean or year, null for a key never stored.
	 * @return array<string, bool|int|object|null>
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
		$state[self::IMMICH_FILTERS_KEY] = $this->config->hasKey($user->getUID(), Application::APP_ID, self::IMMICH_FILTERS_KEY)
			// An object, so the filters of a numeric connection id do not answer as a JSON list.
			? (object)$this->config->getValueArray($user->getUID(), Application::APP_ID, self::IMMICH_FILTERS_KEY)
			: null;
		return $state;
	}

	/**
	 * Stores the keys given and returns the whole view state.
	 * @throws InvalidRequestException for anything but a non-empty object of known keys with boolean values, a year for the year key, or Immich filters per connection
	 * @return array<string, bool|int|object|null>
	 */
	public function save(IUser $user, mixed $viewState): array {
		if (!is_array($viewState) || $viewState === []) {
			throw InvalidRequestException::because(Reason::NotAnObject, 'viewState must be an object with at least one key');
		}
		/** @var array<string, bool|int|array<string, array<mixed>>> $valid */
		$valid = array_filter($viewState, fn (mixed $value, int|string $key): bool => $this->isValid($key, $value), ARRAY_FILTER_USE_BOTH);
		if (count($valid) !== count($viewState)) {
			throw InvalidRequestException::because(Reason::BadValue, 'viewState takes only ' . implode(', ', self::KEYS) . ', each a boolean, ' . self::YEAR_KEY . ', a year, and ' . self::IMMICH_FILTERS_KEY . ', an object of filters per connection');
		}
		$merged = null;
		if (isset($valid[self::IMMICH_FILTERS_KEY])) {
			/** @var array<string, array<mixed>> $filters */
			$filters = $valid[self::IMMICH_FILTERS_KEY];
			$merged = array_replace($this->config->getValueArray($user->getUID(), Application::APP_ID, self::IMMICH_FILTERS_KEY), $filters);
			if (count($merged) > self::MAX_CONNECTIONS) {
				throw InvalidRequestException::because(Reason::TooMany, self::IMMICH_FILTERS_KEY . ' keeps at most ' . self::MAX_CONNECTIONS . ' connections');
			}
			unset($valid[self::IMMICH_FILTERS_KEY]);
		}
		if ($merged !== null) {
			$this->config->setValueArray($user->getUID(), Application::APP_ID, self::IMMICH_FILTERS_KEY, $merged);
		}
		foreach ($valid as $key => $value) {
			if (is_array($value)) {
				continue;
			}
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
		if ($key === self::IMMICH_FILTERS_KEY) {
			return $this->isImmichFilters($value);
		}
		return in_array($key, self::KEYS, true) && is_bool($value);
	}

	/** A non-empty object of connection ids, each holding an object of filters of bounded size; a numeric id decodes as an int key. */
	private function isImmichFilters(mixed $value): bool {
		if (!is_array($value) || $value === []) {
			return false;
		}
		foreach ($value as $connectionId => $filters) {
			if (preg_match(ConnectionsFileShape::ID, (string)$connectionId) !== 1
				|| !is_array($filters) || ($filters !== [] && array_is_list($filters))
				|| strlen((string)json_encode($filters)) > self::MAX_FILTERS_BYTES) {
				return false;
			}
		}
		return true;
	}
}
