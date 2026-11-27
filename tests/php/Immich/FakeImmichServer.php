<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCP\Http\Client\IClient;
use OCP\Http\Client\IClientService;
use OCP\Http\Client\IResponse;

/** An Immich behind a stubbed HTTP client: routes answer by "METHOD /path", every request is recorded. */
trait FakeImmichServer {
	/** @var list<array{method: string, url: string, options: array<string, mixed>}> */
	private array $immichRequests = [];
	/** @var array<string, \Closure(array<string, mixed>): array{int, string, string}> */
	private array $immichRoutes = [];

	/** @param \Closure(array<string, mixed>): array{int, string, string} $answer status, body and content type for a request's options */
	private function immichRoute(string $route, \Closure $answer): void {
		$this->immichRoutes[$route] = $answer;
	}

	private function immichAnswers(string $route, int $status, mixed $json = []): void {
		$this->immichRoute($route, static fn (): array => [$status, json_encode($json, JSON_THROW_ON_ERROR), 'application/json']);
	}

	private function immichDown(string $route): void {
		$this->immichRoute($route, static fn (): never => throw new \RuntimeException('cURL error 28: Operation timed out'));
	}

	/** The JSON body of the last request to the route. */
	private function lastImmichBody(string $route): mixed {
		foreach (array_reverse($this->immichRequests) as $request) {
			if ($route === $request['method'] . ' ' . $this->immichPath($request['url'])) {
				return json_decode((string)($request['options']['body'] ?? 'null'), true, 512, JSON_THROW_ON_ERROR);
			}
		}
		return null;
	}

	private function immichClients(): IClientService {
		$client = $this->createStub(IClient::class);
		$client->method('get')->willReturnCallback(/** @param array<string, mixed> $options */ fn (string $url, array $options = []): IResponse => $this->immichRespond('GET', $url, $options));
		$client->method('post')->willReturnCallback(/** @param array<string, mixed> $options */ fn (string $url, array $options = []): IResponse => $this->immichRespond('POST', $url, $options));
		$client->method('put')->willReturnCallback(/** @param array<string, mixed> $options */ fn (string $url, array $options = []): IResponse => $this->immichRespond('PUT', $url, $options));
		$client->method('delete')->willReturnCallback(/** @param array<string, mixed> $options */ fn (string $url, array $options = []): IResponse => $this->immichRespond('DELETE', $url, $options));
		$clients = $this->createStub(IClientService::class);
		$clients->method('newClient')->willReturn($client);
		return $clients;
	}

	/** @param array<string, mixed> $options */
	private function immichRespond(string $method, string $url, array $options): IResponse {
		$this->immichRequests[] = ['method' => $method, 'url' => $url, 'options' => $options];
		$answer = $this->immichRoutes[$method . ' ' . $this->immichPath($url)] ?? null;
		[$status, $body, $type] = $answer === null ? [404, '{"message":"Not Found"}', 'application/json'] : $answer($options);
		$response = $this->createStub(IResponse::class);
		$response->method('getStatusCode')->willReturn($status);
		$response->method('getBody')->willReturn($body);
		$response->method('getHeader')->willReturnCallback(static fn (string $name): string => strtolower($name) === 'content-type' ? $type : '');
		return $response;
	}

	private function immichPath(string $url): string {
		return substr((string)parse_url($url, PHP_URL_PATH), strlen('/api'));
	}
}
