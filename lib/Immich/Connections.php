<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\AppInfo\Application;
use OCP\IAppConfig;
use Psr\Log\LoggerInterface;

/** The users' Immich connections, read from the administrator's connections file on every request (IMMICH-001). */
final class Connections {
	private const string FILE_KEY = 'connections_file';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private IAppConfig $config,
		private LocalFiles $files,
		private ConnectionsFileShape $shape,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * The user's connections in file order.
	 * @return list<Connection>
	 */
	public function forUser(string $userId): array {
		return array_values(array_filter($this->all(), static fn (Connection $connection): bool => $connection->user === $userId));
	}

	/** The user's connection with the id; someone else's is unknown (IMMICH-001.5). */
	public function find(string $userId, string $connectionId): Connection {
		foreach ($this->forUser($userId) as $connection) {
			if ($connection->id === $connectionId) {
				return $connection;
			}
		}
		throw new ImmichException(ImmichError::UnknownConnection);
	}

	/**
	 * Every user's connections; not configured or a broken file throws.
	 * @return list<Connection>
	 */
	public function all(): array {
		$path = $this->config->getValueString(Application::APP_ID, self::FILE_KEY, '');
		if ($path === '') {
			throw new ImmichException(ImmichError::NotConfigured);
		}
		$content = $this->files->read($path);
		if ($content === null) {
			$this->logger->error('The Immich connections file {path} cannot be read', ['path' => $path]);
			throw new ImmichException(ImmichError::ConnectionsFile);
		}
		try {
			return $this->shape->parse($content);
		} catch (ConnectionsFileViolation $violation) {
			$this->logger->error('The Immich connections file {path} is invalid: {violation}', ['path' => $path, 'violation' => $violation->getMessage()]);
			throw new ImmichException(ImmichError::ConnectionsFile);
		}
	}
}
