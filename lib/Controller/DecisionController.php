<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\DecisionService;
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
final class DecisionController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private DecisionService $decisions,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's stored decisions among the file ids (ADR 0012). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/decisions/lookup')]
	public function lookup(array $fileIds = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['decisions' => $this->decisions->lookup($user, $fileIds)]));
	}

	/** Replaces the user's decisions on the files with the whole states given (ADR 0012). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/decisions')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(array $decisions = []): Response {
		return $this->api->forUser(function (IUser $user) use ($decisions): Response {
			$this->decisions->save($user, $decisions);
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}
}
