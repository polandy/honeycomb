<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\Connections;
use OCA\Honeycomb\Immich\ImmichPictureSource;
use OCA\Honeycomb\Immich\ImmichStatus;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\DataDisplayResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class ImmichController extends Controller {
	private const string IMMUTABLE = 'private, max-age=31536000, immutable';
	private const int PAGE_SIZE = 100;

	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private Connections $connections,
		private ImmichStatus $status,
		private ImmichPictureSource $source,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's Immich connections, without key or key file, and none when not configured (IMMICH-001.1, IMMICH-001.2). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/immich/connections')]
	public function connections(): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse([
			'connections' => $this->connections->isConfigured()
				? array_map(static fn (Connection $connection): array => $connection->toArray(), $this->connections->forUser($user->getUID()))
				: [],
		]));
	}

	/** The connection's state, account, version and number of uploads (IMMICH-001.8). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/immich/{connectionId}/status')]
	public function status(string $connectionId): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(
			$this->status->of($this->connections->find($user->getUID(), $connectionId)),
		));
	}

	/** One page of the connection's uploads that pass the filters (IMMICH-002.1), from an asset on `from` (IMMICH-002.34). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/immich/{connectionId}/assets')]
	public function assets(string $connectionId, array $filters = [], ?string $cursor = null, int $size = self::PAGE_SIZE, ?array $from = null): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(
			$this->source->listing($this->connections->find($user->getUID(), $connectionId), ['filters' => $filters, 'cursor' => $cursor, 'size' => $size, 'from' => $from]),
		));
	}

	/** Saves the whole decision of each asset under the connection, without asking Immich (IMMICH-003.1). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/immich/{connectionId}/decisions')]
	public function decisions(string $connectionId, mixed $decisions = null): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(
			$this->source->decide($this->connections->find($user->getUID(), $connectionId), $decisions),
		));
	}

	/** The server's numbers for the toolbar, the flag chips and each filter option (IMMICH-002.13). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/immich/{connectionId}/counts')]
	public function counts(string $connectionId, array $filters = [], array $periods = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(
			$this->source->counts($this->connections->find($user->getUID(), $connectionId), ['filters' => $filters, 'periods' => $periods]),
		));
	}

	/** Immich's thumbnail or preview of the asset, immutable for a year (IMMICH-002.16). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/immich/{connectionId}/assets/{assetId}/image')]
	public function image(string $connectionId, string $assetId, string $size): Response {
		return $this->api->forUser(function (IUser $user) use ($connectionId, $assetId, $size): Response {
			$image = $this->source->image($this->connections->find($user->getUID(), $connectionId), ['assetId' => $assetId, 'size' => $size]);
			return new DataDisplayResponse($image['body'], Http::STATUS_OK, ['Content-Type' => $image['type'], 'Cache-Control' => self::IMMUTABLE]);
		});
	}
}
