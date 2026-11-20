<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Parses the connections file; one violation invalidates the whole file (IMMICH-001.3). */
final class ConnectionsFileShape {
	private const int VERSION = 1;
	private const array TOP_FIELDS = ['version', 'connections'];
	private const array STRING_FIELDS = ['id', 'user', 'label', 'url', 'keyFile'];
	private const string FAVOURITES = 'picksAsFavorites';
	private const string ID = '/^[a-z0-9-]{1,64}$/';
	private const array SCHEMES = ['http', 'https'];

	/**
	 * The file's connections in file order.
	 * @return list<Connection>
	 * @throws ConnectionsFileViolation naming the first violation
	 */
	public function parse(string $content): array {
		try {
			$file = json_decode($content, false, 64, JSON_THROW_ON_ERROR);
		} catch (\JsonException) {
			throw new ConnectionsFileViolation('is not JSON');
		}
		if (!$file instanceof \stdClass) {
			throw new ConnectionsFileViolation('is not an object');
		}
		$fields = get_object_vars($file);
		$this->checkKnown($fields, self::TOP_FIELDS, '');
		if (($fields['version'] ?? null) !== self::VERSION) {
			throw new ConnectionsFileViolation('version must be ' . self::VERSION);
		}
		$entries = $fields['connections'] ?? null;
		if (!is_array($entries) || !array_is_list($entries)) {
			throw new ConnectionsFileViolation('connections must be a list');
		}
		$connections = [];
		/** @var mixed $entry */
		foreach ($entries as $index => $entry) {
			$connection = $this->connection($entry, "connections[$index]");
			if (array_key_exists($connection->id, $connections)) {
				throw new ConnectionsFileViolation("connections[$index]: id {$connection->id} is not unique");
			}
			$connections[$connection->id] = $connection;
		}
		return array_values($connections);
	}

	private function connection(mixed $entry, string $where): Connection {
		if (!$entry instanceof \stdClass) {
			throw new ConnectionsFileViolation("$where is not an object");
		}
		$fields = get_object_vars($entry);
		$this->checkKnown($fields, [...self::STRING_FIELDS, self::FAVOURITES], "$where: ");
		$strings = [];
		foreach (self::STRING_FIELDS as $name) {
			if (!array_key_exists($name, $fields)) {
				throw new ConnectionsFileViolation("$where: $name is missing");
			}
			$value = $fields[$name];
			if (!is_string($value) || $value === '') {
				throw new ConnectionsFileViolation("$where: $name must be a non-empty string");
			}
			$strings[$name] = $value;
		}
		$favourites = $fields[self::FAVOURITES] ?? false;
		if (!is_bool($favourites)) {
			throw new ConnectionsFileViolation("$where: " . self::FAVOURITES . ' must be a boolean');
		}
		if (preg_match(self::ID, $strings['id']) !== 1) {
			throw new ConnectionsFileViolation("$where: id must be 1 to 64 of a-z, 0-9 and -");
		}
		if (!$this->isOrigin($strings['url'])) {
			throw new ConnectionsFileViolation("$where: url must be an http or https origin");
		}
		if (!str_starts_with($strings['keyFile'], '/')) {
			throw new ConnectionsFileViolation("$where: keyFile must be an absolute path");
		}
		return new Connection($strings['id'], $strings['user'], $strings['label'], $strings['url'], $strings['keyFile'], $favourites);
	}

	/**
	 * @param array<string, mixed> $fields
	 * @param list<string> $known
	 */
	private function checkKnown(array $fields, array $known, string $where): void {
		foreach (array_keys($fields) as $name) {
			if (!in_array($name, $known, true)) {
				throw new ConnectionsFileViolation("{$where}unknown field $name");
			}
		}
	}

	/** Scheme, host and an optional port, with at most a trailing slash. */
	private function isOrigin(string $url): bool {
		$parts = parse_url($url);
		if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
			return false;
		}
		$extra = array_diff_key($parts, ['scheme' => true, 'host' => true, 'port' => true, 'path' => true]);
		return in_array(strtolower($parts['scheme']), self::SCHEMES, true) && $extra === [] && in_array($parts['path'] ?? '', ['', '/'], true);
	}
}
