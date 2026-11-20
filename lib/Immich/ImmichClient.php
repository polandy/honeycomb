<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\Http\Client\IClientService;
use OCP\Http\Client\IResponse;
use Psr\Log\LoggerInterface;

/** Calls one Immich connection's API with its key and maps every failure to one error code (IMMICH-001, ADR 0042). */
final class ImmichClient {
	private const string API = '/api';
	private const int CONNECT_TIMEOUT = 5;
	private const int TIMEOUT = 30;
	private const string JSON = 'application/json';
	private const string IMAGE = 'image/';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private IClientService $clients,
		private LocalFiles $files,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * One page of Immich's metadata search.
	 * @param array<string, mixed> $body
	 * @return array{items: list<mixed>, nextCursor: ?string}
	 */
	public function search(Connection $connection, array $body): array {
		$answer = $this->json($connection, 'POST', '/search/metadata', 'asset.read', ['body' => $body]);
		/** @var mixed $assets */
		$assets = $answer['assets'] ?? null;
		/** @var mixed $items */
		$items = is_array($assets) ? ($assets['items'] ?? null) : null;
		/** @var mixed $next */
		$next = is_array($assets) ? ($assets['nextCursor'] ?? null) : null;
		if (!is_array($items) || !array_is_list($items) || ($next !== null && !is_string($next))) {
			throw $this->failure($connection, ImmichError::Version, 'the search answer does not fit');
		}
		return ['items' => $items, 'nextCursor' => $next];
	}

	/**
	 * The number of assets the search filter matches.
	 * @param array<string, mixed> $filter
	 */
	public function statistics(Connection $connection, array $filter): int {
		/** @var mixed $total */
		$total = $this->json($connection, 'POST', '/search/statistics', 'asset.statistics', ['body' => ['filter' => $filter]])['total'] ?? null;
		return is_int($total) ? $total : throw $this->failure($connection, ImmichError::Version, 'the statistics answer does not fit');
	}

	/** The name of the key's Immich account. */
	public function userName(Connection $connection): string {
		/** @var mixed $name */
		$name = $this->json($connection, 'GET', '/users/me', 'user.read', [])['name'] ?? null;
		return is_string($name) ? $name : throw $this->failure($connection, ImmichError::Version, 'the account answer does not fit');
	}

	/**
	 * Immich's version; the route needs no key.
	 * @return array{major: int, minor: int, patch: int}
	 */
	public function version(Connection $connection): array {
		$answer = $this->json($connection, 'GET', '/server/version', null, []);
		$version = ['major' => $answer['major'] ?? null, 'minor' => $answer['minor'] ?? null, 'patch' => $answer['patch'] ?? null];
		if (!is_int($version['major']) || !is_int($version['minor']) || !is_int($version['patch'])) {
			throw $this->failure($connection, ImmichError::Version, 'the version answer does not fit');
		}
		return $version;
	}

	/**
	 * Immich's rendered image of the asset in the size; one Immich does not know is an unknown asset.
	 * @return array{body: string, type: string}
	 */
	public function thumbnail(Connection $connection, string $assetId, string $size): array {
		$response = $this->send($connection, 'GET', '/assets/' . rawurlencode($assetId) . '/thumbnail', 'asset.view', ['query' => ['size' => $size]]);
		$status = $response->getStatusCode();
		if ($status === 400 || $status === 404) {
			throw $this->failure($connection, ImmichError::UnknownAsset, "the image of asset $assetId answered $status");
		}
		$type = $response->getHeader('Content-Type');
		$body = $response->getBody();
		if ($status !== 200 || !str_starts_with($type, self::IMAGE) || !is_string($body)) {
			throw $this->failure($connection, ImmichError::Version, "the image of asset $assetId answered $status");
		}
		return ['body' => $body, 'type' => $type];
	}

	/**
	 * The JSON object of a successful answer.
	 * @param array{body?: array<string, mixed>} $request
	 * @return array<array-key, mixed>
	 */
	private function json(Connection $connection, string $method, string $path, ?string $scope, array $request): array {
		$options = [];
		if (isset($request['body'])) {
			$options['body'] = json_encode($request['body'] === [] ? new \stdClass() : $request['body'], JSON_THROW_ON_ERROR);
			$options['headers'] = ['Content-Type' => self::JSON];
		}
		$response = $this->send($connection, $method, $path, $scope, $options);
		$status = $response->getStatusCode();
		$body = $response->getBody();
		if ($status < 200 || $status > 299 || !is_string($body)) {
			throw $this->failure($connection, ImmichError::Version, "$method $path answered $status");
		}
		try {
			/** @var mixed $answer */
			$answer = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
		} catch (\JsonException) {
			throw $this->failure($connection, ImmichError::Version, "$method $path answered no JSON");
		}
		return is_array($answer) ? $answer : throw $this->failure($connection, ImmichError::Version, "$method $path answered no object");
	}

	/**
	 * Sends the request with the key when the route has a scope; a refused key, a missing scope or a server failure throws.
	 * @param array<string, mixed> $options
	 */
	private function send(Connection $connection, string $method, string $path, ?string $scope, array $options): IResponse {
		$headers = ['Accept' => self::JSON, ...(array)($options['headers'] ?? [])];
		if ($scope !== null) {
			$headers['x-api-key'] = $this->key($connection);
		}
		$options = [...$options, 'headers' => $headers, 'connect_timeout' => self::CONNECT_TIMEOUT, 'timeout' => self::TIMEOUT, 'http_errors' => false, 'nextcloud' => ['allow_local_address' => true]];
		$url = rtrim($connection->url, '/') . self::API . $path;
		try {
			$client = $this->clients->newClient();
			$response = $method === 'POST' ? $client->post($url, $options) : $client->get($url, $options);
		} catch (\Exception $failure) {
			throw $this->failure($connection, ImmichError::Unreachable, "$method $path failed: " . $failure->getMessage());
		}
		$status = $response->getStatusCode();
		return match (true) {
			$status === 401 => throw $this->failure($connection, ImmichError::Refused, "$method $path refused the key"),
			$status === 403 => throw $this->failure($connection, ImmichError::Scope, "$method $path needs the scope $scope", $scope),
			$status >= 500 => throw $this->failure($connection, ImmichError::Unreachable, "$method $path answered $status"),
			default => $response,
		};
	}

	/** The connection's key, read from its key file for this call only. */
	private function key(Connection $connection): string {
		$key = trim($this->files->read($connection->keyFile) ?? '');
		if ($key === '') {
			$this->logger->error('The key file {keyFile} of the Immich connection {connection} is missing or empty', ['keyFile' => $connection->keyFile, 'connection' => $connection->id]);
			throw new ImmichException(ImmichError::Key);
		}
		return $key;
	}

	private function failure(Connection $connection, ImmichError $error, string $reason, ?string $scope = null): ImmichException {
		$this->logger->warning('The Immich connection {connection}: {reason}', ['connection' => $connection->id, 'reason' => $reason]);
		return new ImmichException($error, $scope);
	}
}
