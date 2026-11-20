<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** Probes one connection: version, the listing's search, the account and the number of uploads (IMMICH-001.8 to .11). */
final class ImmichStatus {
	public const string OK = 'ok';
	private const int MAJOR = 3;
	private const int MIN_MINOR = 2;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
		private ImmichSearchFilter $filter,
	) {
	}

	/**
	 * The connection's state, account, version and number of uploads; what the key may not read is null.
	 * @return array{state: string, account: ?string, version: ?string, total: ?int}
	 */
	public function of(Connection $connection): array {
		$version = null;
		try {
			$parts = $this->client->version($connection);
			$version = "{$parts['major']}.{$parts['minor']}.{$parts['patch']}";
			if ($parts['major'] !== self::MAJOR || $parts['minor'] < self::MIN_MINOR) {
				return $this->failed(ImmichError::Version, $version);
			}
		} catch (ImmichException $failure) {
			if ($failure->error !== ImmichError::Refused && $failure->error !== ImmichError::Scope) {
				return $this->failed($failure->error, null);
			}
		}
		try {
			$this->client->search($connection, ['filter' => $this->filter->uploads(), 'size' => 1]);
			$account = $this->unlessScope(fn (): string => $this->client->userName($connection));
			$total = $this->unlessScope(fn (): int => $this->client->statistics($connection, $this->filter->uploads()));
		} catch (ImmichException $failure) {
			return $this->failed($failure->error, $version);
		}
		return ['state' => self::OK, 'account' => $account, 'version' => $version, 'total' => $total];
	}

	/**
	 * The call's answer, or null when the key lacks its scope.
	 * @template T
	 * @param \Closure(): T $call
	 * @return ?T
	 */
	private function unlessScope(\Closure $call): mixed {
		try {
			return $call();
		} catch (ImmichException $failure) {
			return $failure->error === ImmichError::Scope ? null : throw $failure;
		}
	}

	/** @return array{state: string, account: null, version: ?string, total: null} */
	private function failed(ImmichError $error, ?string $version): array {
		return ['state' => $error->value, 'account' => null, 'version' => $version, 'total' => null];
	}
}
