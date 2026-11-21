<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

// The generic upstream stub of the e2e run: a router for PHP's built-in web server (ADR 0041).

/** An answer of the stub: status, content type and body. */
final class StubAnswer {
	public function __construct(
		public readonly int $status,
		public readonly string $type,
		public readonly string $body,
	) {
	}

	/** The fixture file as a JSON answer. */
	public static function jsonFile(string $path, int $status = 200): self {
		$body = file_get_contents($path);
		return $body === false ? throw new RuntimeException("The stub fixture $path cannot be read") : new self($status, 'application/json', $body);
	}

	/** The file's bytes as an answer of the type. */
	public static function file(string $path, string $type): self {
		$body = file_get_contents($path);
		return $body === false ? throw new RuntimeException("The stub fixture $path cannot be read") : new self(200, $type, $body);
	}

	/** The value as a JSON answer. */
	public static function json(mixed $value, int $status = 200): self {
		return new self($status, 'application/json', json_encode($value, JSON_THROW_ON_ERROR));
	}
}

/**
 * Answers the request from the first route that matches it; only an operation of the pinned schema may be a route.
 * @param string $schemaFile the pinned OpenAPI file of the upstream
 * @param string $prefix the API's path prefix before the schema's paths
 * @param list<array{0: string, 1: string, 2: \Closure(array<string, string>, string): StubAnswer}> $routes method, schema path and the answer by lower-case request header and path
 */
function stubServe(string $schemaFile, string $prefix, array $routes): void {
	/** @var array{paths: array<string, array<string, mixed>>} $schema */
	$schema = json_decode((string)file_get_contents($schemaFile), true, 512, JSON_THROW_ON_ERROR);
	$method = strtolower((string)$_SERVER['REQUEST_METHOD']);
	$path = (string)parse_url((string)$_SERVER['REQUEST_URI'], PHP_URL_PATH);
	$headers = array_change_key_case(getallheaders());
	foreach ($routes as [$routeMethod, $template]) {
		if (!isset($schema['paths'][$template][$routeMethod])) {
			stubLog("The stub route $routeMethod $template is not in the pinned schema");
			stubSend(StubAnswer::json(['message' => 'Not in the pinned schema'], 500));
			return;
		}
	}
	foreach ($routes as [$routeMethod, $template, $answer]) {
		$pattern = '#^' . preg_quote($prefix, '#') . preg_replace('#\\\{[^/]+\\\}#', '[^/]+', preg_quote($template, '#')) . '$#';
		if ($routeMethod === $method && preg_match($pattern, $path) === 1) {
			stubSend($answer($headers, $path));
			return;
		}
	}
	stubLog("The stub has no route for $method $path");
	stubSend(StubAnswer::json(['message' => 'Not Found'], 404));
}

/**
 * The request's JSON body, or an empty array without one.
 * @return array<array-key, mixed>
 */
function stubBody(): array {
	$body = json_decode((string)file_get_contents('php://input'), true);
	return is_array($body) ? $body : [];
}

function stubSend(StubAnswer $answer): void {
	http_response_code($answer->status);
	header('Content-Type: ' . $answer->type);
	echo $answer->body;
}

/** Writes the line to the container's output; `php -q -S` drops `error_log`. */
function stubLog(string $line): void {
	file_put_contents('php://stderr', "$line\n");
}
