<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

// The stub Immich: the routes honeycomb calls, answered by the fixtures its contract tests check against the pinned schema.

require __DIR__ . '/stub.php';

const FIXTURES = __DIR__ . '/../../fixtures/immich';
/** The one key the stub takes, from `e2e/family-key.txt`; it refuses every other key as Immich does. */
const KEY = 'e2e-key-family';

/**
 * The answer for a request with the stub's key, else Immich's 401.
 * @param \Closure(): StubAnswer $answer
 * @return \Closure(array<string, string>): StubAnswer
 */
function keyed(\Closure $answer): \Closure {
	return static fn (array $headers): StubAnswer => ($headers['x-api-key'] ?? '') === KEY
		? $answer()
		: StubAnswer::json(['message' => 'Invalid API key', 'statusCode' => 401, 'error' => 'Unauthorized'], 401);
}

stubServe(FIXTURES . '/openapi.json', '/api', [
	['get', '/server/version', static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/version.json')],
	['get', '/users/me', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/me.json'))],
	['post', '/search/metadata', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/search-page.json'))],
	['post', '/search/statistics', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/statistics.json'))],
	['get', '/search/suggestions', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/suggestions.json'))],
]);
