<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\TagService;
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
final class TagController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private TagService $service,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's stored tags among the file ids (ADR 0022). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/tags/lookup')]
	public function lookup(array $fileIds = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['tags' => $this->service->lookup($user, $fileIds)]));
	}

	/** Replaces the user's tags on the files with the whole lists given (ADR 0022). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/tags')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(array $tags = []): Response {
		return $this->api->forUser(function (IUser $user) use ($tags): Response {
			$this->service->save($user, $tags);
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}

	/** Every tag the user has had, for autocomplete and the filter (ADR 0022). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/tags/list')]
	public function tagList(): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['tagList' => $this->service->tagList($user)]));
	}
}
