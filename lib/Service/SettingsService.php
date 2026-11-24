<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\Reason;
use OCP\Config\IUserConfig;
use OCP\IUser;
use stdClass;

/**
 * Keeps each user's settings as one JSON object and the lists that change on their own each under its
 * own key; the client checks every field (ADR 0014, ADR 0051).
 */
final class SettingsService {
	/** The largest encoded settings object, or list, that is stored. */
	public const int MAX_BYTES = 8192;

	private const string KEY = 'settings';

	/** Each list's field in the settings object and its own key. */
	private const array LISTS = ['moveRecent' => 'move_recent', 'moveFavourites' => 'move_favourites', 'libraryRoots' => 'library_roots'];

	public function __construct(
		private IUserConfig $config,
	) {
	}

	/** The stored settings with each stored list, an empty object when none or no object is stored. */
	public function get(IUser $user): stdClass {
		$settings = $this->storedObject($user);
		foreach (self::LISTS as $field => $key) {
			$list = $this->storedList($user, $key);
			if ($list !== null) {
				$settings->{$field} = $list;
			}
		}
		return $settings;
	}

	/**
	 * Stores the whole settings object without the lists and returns the settings as stored.
	 * @throws InvalidRequestException for anything but an object, or one over MAX_BYTES encoded
	 */
	public function save(IUser $user, mixed $settings): stdClass {
		if (!is_array($settings) || ($settings !== [] && array_is_list($settings))) {
			throw InvalidRequestException::because(Reason::NotAnObject, 'settings must be a JSON object');
		}
		$encoded = $this->encode((object)array_diff_key($settings, self::LISTS), 'settings must be at most ' . self::MAX_BYTES . ' bytes');
		$this->carryOverLists($user);
		$this->config->setValueString($user->getUID(), Application::APP_ID, self::KEY, $encoded);
		return $this->get($user);
	}

	/**
	 * Stores one whole list under its own key and returns it.
	 * @return list<string>
	 * @throws InvalidRequestException for an unknown list, anything but a list of strings, or one over MAX_BYTES encoded
	 */
	public function saveList(IUser $user, string $name, mixed $items): array {
		$key = self::LISTS[$name] ?? throw InvalidRequestException::because(Reason::UnknownName, 'there is no settings list ' . $name);
		if (!is_array($items) || !array_is_list($items) || array_filter($items, is_string(...)) !== $items) {
			throw InvalidRequestException::because(Reason::NotAList, 'a settings list must be a JSON list of strings');
		}
		/** @var list<string> $items */
		$encoded = $this->encode($items, 'a settings list must be at most ' . self::MAX_BYTES . ' bytes');
		$this->config->setValueString($user->getUID(), Application::APP_ID, $key, $encoded);
		return $items;
	}

	/** Writes each list still in the stored object, from before ADR 0051, into its own key while that is unset. */
	private function carryOverLists(IUser $user): void {
		$stored = $this->storedObject($user);
		foreach (self::LISTS as $field => $key) {
			if (property_exists($stored, $field) && $this->storedList($user, $key) === null) {
				$this->config->setValueString($user->getUID(), Application::APP_ID, $key, json_encode($stored->{$field}, JSON_THROW_ON_ERROR));
			}
		}
	}

	/** The stored object, an empty one when none or no object is stored. */
	private function storedObject(IUser $user): stdClass {
		/** @var mixed $stored */
		$stored = json_decode($this->config->getValueString($user->getUID(), Application::APP_ID, self::KEY, '{}'));
		return $stored instanceof stdClass ? $stored : new stdClass();
	}

	/** The list stored under its own key, empty when that is no list, null when the key is unset. */
	private function storedList(IUser $user, string $key): ?array {
		$stored = $this->config->getValueString($user->getUID(), Application::APP_ID, $key, '');
		if ($stored === '') {
			return null;
		}
		/** @var mixed $list */
		$list = json_decode($stored);
		return is_array($list) ? $list : [];
	}

	/** The value as JSON. @throws InvalidRequestException when it is over MAX_BYTES encoded */
	private function encode(object|array $value, string $tooLarge): string {
		$encoded = json_encode($value, JSON_THROW_ON_ERROR);
		if (strlen($encoded) > self::MAX_BYTES) {
			throw InvalidRequestException::because(Reason::TooLarge, $tooLarge);
		}
		return $encoded;
	}
}
