<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

// The stub Immich: the routes honeycomb calls, answered by the fixtures its contract tests check against the pinned schema.

require __DIR__ . '/stub.php';

const FIXTURES = __DIR__ . '/../../fixtures/immich';
/** The one key the stub takes, from `e2e/family-key.txt`; it refuses every other key as Immich does. */
const KEY = 'e2e-key-family';
/** The stub library's uploads, as many as `statistics.json` counts. */
const LIBRARY_SIZE = 3660;
/** The newest upload's capture time; each older one is a minute before the one after it. */
const NEWEST_TAKEN = 1795023912;
const SECONDS_PER_UPLOAD = 60;
const ASSET_ID = '00000000-0000-4000-8000-%012d';
const THUMBNAIL = __DIR__ . '/../../fixtures/images/landscape-600x400.jpg';
/** The search fixture's live photo, video and stack, which the second to fourth upload copy for the tile pills. */
const KINDS_FROM = 1;
const KINDS_TO = 3;

/**
 * The answer for a request with the stub's key, else Immich's 401.
 * @param \Closure(string): StubAnswer $answer the answer by request path
 * @return \Closure(array<string, string>, string): StubAnswer
 */
function keyed(\Closure $answer): \Closure {
	return static fn (array $headers, string $path): StubAnswer => ($headers['x-api-key'] ?? '') === KEY
		? $answer($path)
		: StubAnswer::json(['message' => 'Invalid API key', 'statusCode' => 401, 'error' => 'Unauthorized'], 401);
}

/**
 * The page of the library at the request's cursor in the asked order: a search fixture's asset with the upload's id, name and time.
 * The cursor is the offset of the page's first upload; of the filter the stub honours only the capture time's bounds and the asked ids.
 */
function searchPage(): StubAnswer {
	$body = stubBody();
	$offset = (int)($body['cursor'] ?? 0);
	$size = (int)($body['size'] ?? 100);
	/** @var array{assets: array{items: list<array<string, mixed>>}} $fixture */
	$fixture = json_decode((string)file_get_contents(FIXTURES . '/search-page.json'), true, 512, JSON_THROW_ON_ERROR);
	$assets = $fixture['assets']['items'];
	$ids = askedIds($body['filter']['or'] ?? []);
	$indexes = array_values(array_filter(range(0, LIBRARY_SIZE - 1), static fn (int $index): bool => takenWithin($body['filter']['takenAt'] ?? [], NEWEST_TAKEN - $index * SECONDS_PER_UPLOAD)
		&& ($ids === null || in_array(sprintf(ASSET_ID, $index), $ids, true))));
	if (($body['orderBy']['direction'] ?? 'desc') === 'asc') {
		$indexes = array_reverse($indexes);
	}
	$items = array_map(static fn (int $index): array => upload($assets[$index >= KINDS_FROM && $index <= KINDS_TO ? $index : 0], $index), array_slice($indexes, $offset, $size));
	$next = $offset + $size < count($indexes) ? (string)($offset + $size) : null;
	return StubAnswer::json(['assets' => ['total' => count($items), 'count' => count($items), 'items' => $items, 'facets' => [], 'nextPage' => $next, 'nextCursor' => $next]]);
}

/**
 * The ids the filter's `or` branches ask for, or null when it asks for none.
 * @param mixed $branches
 * @return ?list<string>
 */
function askedIds(mixed $branches): ?array {
	$ids = is_array($branches) ? array_values(array_filter(array_map(static fn (mixed $branch): mixed => is_array($branch) ? ($branch['id']['eq'] ?? null) : null, $branches), 'is_string')) : [];
	return $ids === [] ? null : $ids;
}

/**
 * Whether the capture time passes the filter's `gte`, `lt` and `lte` bounds.
 * @param mixed $bounds
 */
function takenWithin(mixed $bounds, int $taken): bool {
	$bound = static fn (string $key): ?int => is_array($bounds) && is_string($bounds[$key] ?? null) ? (int)strtotime($bounds[$key]) : null;
	return !(($bound('gte') ?? $taken) > $taken || ($bound('lt') ?? $taken + 1) <= $taken || ($bound('lte') ?? $taken) < $taken);
}

/**
 * The library's upload at the index, newest first, named `PXL_E2E_<index + 1>`.
 * @param array<string, mixed> $photo
 * @return array<string, mixed>
 */
function upload(array $photo, int $index): array {
	$taken = gmdate('Y-m-d\\TH:i:s.000\\Z', NEWEST_TAKEN - $index * SECONDS_PER_UPLOAD);
	$name = sprintf('PXL_E2E_%04d.jpg', $index + 1);
	/** @var array<string, mixed> $exif */
	$exif = $photo['exifInfo'];
	$id = sprintf(ASSET_ID, $index);
	return array_merge($photo, [
		'id' => $id,
		'stack' => is_array($photo['stack']) ? array_merge($photo['stack'], ['primaryAssetId' => $id]) : null,
		'originalFileName' => $name,
		'deviceAssetId' => $name,
		'fileCreatedAt' => $taken,
		'localDateTime' => substr($taken, 0, -1),
		'exifInfo' => array_merge($exif, ['dateTimeOriginal' => $taken]),
	]);
}

/** The thumbnail fixture for an asset of the library, else Immich's 404. */
function thumbnail(string $path): StubAnswer {
	$index = sscanf(basename(dirname($path)), ASSET_ID);
	return isset($index[0]) && $index[0] < LIBRARY_SIZE
		? StubAnswer::file(THUMBNAIL, 'image/jpeg')
		: StubAnswer::json(['message' => 'Not found or no asset.view access', 'statusCode' => 400, 'error' => 'Bad Request'], 400);
}

/** The library's upload an asset path names, as Immich answers a change of it, else Immich's 400. */
function updated(string $path): StubAnswer {
	$index = sscanf(basename($path), ASSET_ID);
	/** @var array{assets: array{items: list<array<string, mixed>>}} $fixture */
	$fixture = json_decode((string)file_get_contents(FIXTURES . '/search-page.json'), true, 512, JSON_THROW_ON_ERROR);
	return isset($index[0]) && $index[0] < LIBRARY_SIZE
		? StubAnswer::json(upload($fixture['assets']['items'][0], $index[0]))
		: StubAnswer::json(['message' => 'Not found or no asset.update access', 'statusCode' => 400, 'error' => 'Bad Request'], 400);
}

stubServe(FIXTURES . '/openapi.json', '/api', [
	['get', '/server/version', static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/version.json')],
	['get', '/users/me', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/me.json'))],
	['post', '/search/metadata', keyed(static fn (): StubAnswer => searchPage())],
	['get', '/assets/{id}/thumbnail', keyed(thumbnail(...))],
	['post', '/search/statistics', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/statistics.json'))],
	['get', '/search/suggestions', keyed(static fn (): StubAnswer => StubAnswer::jsonFile(FIXTURES . '/suggestions.json'))],
	// The write: no upload is in an album, and every change of an upload is taken.
	['get', '/albums', keyed(static fn (): StubAnswer => StubAnswer::json([]))],
	['delete', '/assets', keyed(static fn (): StubAnswer => new StubAnswer(204, 'application/json', ''))],
	['post', '/trash/restore/assets', keyed(static fn (): StubAnswer => StubAnswer::json(['count' => count(stubBody()['ids'] ?? [])]))],
	['put', '/assets/{id}', keyed(updated(...))],
]);
