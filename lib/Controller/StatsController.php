<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\StatsService;
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
final class StatsController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private StatsService $stats,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's daily counters of the days from `from` to `to`, both included, and the first counted day (STATS-001). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/stats')]
	public function index(?string $from = null, ?string $to = null): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->stats->read($user, $from, $to)));
	}

	/** Resets the user's statistics; photos, sidecars and flags stay (STATS-001.3). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'DELETE', url: '/api/v1/stats')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function reset(): Response {
		return $this->api->forUser(function (IUser $user): Response {
			$this->stats->reset($user);
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}
}
