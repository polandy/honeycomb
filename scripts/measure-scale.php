<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

// Usage (in the e2e container): php measure-scale.php <user> listing <path> | <user> decisions|tags|xmp-save|xmp-lookup <count> <path prefix>

use OCA\Honeycomb\Service\DecisionService;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\TagService;
use OCA\Honeycomb\Service\XmpCacheService;
use OCP\IDBConnection;
use OCP\IUserManager;
use OCP\IUserSession;
use OCP\Server;

require '/var/www/html/lib/base.php';

const QUERY_LOG = '/tmp/honeycomb-query.log';

[, $userId, $action, $argument] = $argv;
$user = Server::get(IUserManager::class)->get($userId) ?? throw new RuntimeException("No user $userId");
Server::get(IUserSession::class)->setUser($user);
\OC_Util::setupFS($userId);

/** The file ids of the first `$count` files below `$prefix` in the user's home storage, of `$extension` if given. */
function fileIds(int $count, string $prefix, string $extension = '%'): array {
	$query = Server::get(IDBConnection::class)->getQueryBuilder();
	$query->select('fileid')->from('filecache')
		->where($query->expr()->like('path', $query->createNamedParameter('files/' . trim($prefix, '/') . '/%.' . $extension)))
		->setMaxResults($count);
	return array_map('intval', $query->executeQuery()->fetchAll(PDO::FETCH_COLUMN));
}

$run = match ($action) {
	'listing' => static function () use ($user, $argument): string {
		$listing = json_decode(json_encode(Server::get(ListingService::class)->list($user, $argument, true)), true);
		return count($listing['entries']) . ' entries in ' . count($listing['folders']) . ' folders' . ($listing['truncated'] ? ', truncated' : '');
	},
	'decisions' => static function () use ($user, $argument, $argv): string {
		$items = array_map(static fn (int $id): array => ['fileId' => $id, 'rating' => 3, 'colourLabel' => 'red', 'flag' => 'picked', 'keepRaw' => false], fileIds((int)$argument, $argv[4]));
		Server::get(DecisionService::class)->save($user, $items);
		return count($items) . ' decisions saved';
	},
	'tags' => static function () use ($user, $argument, $argv): string {
		$items = array_map(static fn (int $id): array => ['fileId' => $id, 'tags' => ['bird', 'sky']], fileIds((int)$argument, $argv[4]));
		Server::get(TagService::class)->save($user, $items);
		return count($items) . ' tag lists saved';
	},
	'xmp-save' => static function () use ($user, $argument, $argv): string {
		$rows = array_map(static fn (int $id): array => ['fileId' => $id, 'kind' => 'embedded', 'etag' => "etag-$id", 'reader' => 1, 'state' => 'read', 'reason' => null, 'rating' => 3, 'flag' => 'picked', 'colourLabel' => null, 'keepRaw' => null, 'tags' => ['bird', 'sky']], fileIds((int)$argument, $argv[4], 'jpg'));
		return count(Server::get(XmpCacheService::class)->save($user, $rows)) . ' cache rows saved';
	},
	'xmp-lookup' => static function () use ($user, $argument, $argv): string {
		return count(Server::get(XmpCacheService::class)->lookup($user, fileIds((int)$argument, $argv[4], 'jpg'))) . ' cache rows found';
	},
};

// The file id query of a save is logged too; one query among a hundred does not change the picture.
file_put_contents(QUERY_LOG, '');
$start = hrtime(true);
$result = $run();
printf("%s %s: %s in %.0f ms, %d queries, peak memory %.0f MB\n", $action, $argument, $result, (hrtime(true) - $start) / 1e6, count(file(QUERY_LOG)), memory_get_peak_usage(true) / 1048576);
