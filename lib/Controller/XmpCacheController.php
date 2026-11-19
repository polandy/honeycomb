<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\CacheClear;
use OCA\Honeycomb\Service\XmpCacheService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class XmpCacheController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private XmpCacheService $service,
		private CacheClear $cacheClear,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's cached XMP rows of `$fileIds`; a POST, since a folder's ids do not fit a URL (ADR 0032). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/xmp-cache/lookup')]
	public function lookup(array $fileIds = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['entries' => $this->service->lookup($user, $fileIds)]));
	}

	/** Stores the rows the client read and answers the file ids stored (ADR 0032). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/xmp-cache')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(array $entries = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['saved' => $this->service->save($user, $entries)]));
	}

	/** Clears the user's XMP cache and visual hashes; sidecars and flags stay (ADR 0032). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'DELETE', url: '/api/v1/xmp-cache')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function clear(): Response {
		return $this->api->forUser(function (IUser $user): Response {
			$this->cacheClear->clear($user->getUID());
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}
}
