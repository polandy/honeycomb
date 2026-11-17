<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\LegacyService;
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
final class LegacyController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private LegacyService $service,
	) {
		parent::__construct($appName, $request);
	}

	/** The folders still holding legacy rows and the count of unreachable file ids (XMP-007). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/legacy/folders')]
	public function folders(): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->service->folders($user)));
	}

	/** The legacy rows of the file ids the user no longer reaches (XMP-007). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/legacy/export')]
	public function export(): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->service->export($user)));
	}

	/** Removes the user's legacy rows of `$fileIds` once their sidecars hold them (XMP-007). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'DELETE', url: '/api/v1/legacy')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function acknowledge(array $fileIds = []): Response {
		return $this->api->forUser(function (IUser $user) use ($fileIds): Response {
			$this->service->acknowledge($user, $fileIds);
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}
}
