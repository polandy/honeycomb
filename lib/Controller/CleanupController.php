<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\OrphanedFlags;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class CleanupController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private OrphanedFlags $orphans,
	) {
		parent::__construct($appName, $request);
	}

	/** Removes the orphaned flags of every user; an admin only, as `occ honeycomb:cleanup` does (ADR 0040). */
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/cleanup')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function cleanup(): Response {
		return $this->api->forUser(fn (): Response => new JSONResponse(['removed' => $this->orphans->remove()]));
	}
}
