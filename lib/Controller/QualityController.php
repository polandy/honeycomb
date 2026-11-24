<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\Quality\QualityService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class QualityController extends Controller {
	/** Saves a user may send per period, as many as for the visual hashes (ADR 0046). */
	private const int SAVES_PER_PERIOD = 300;
	/** The period of the save limit in seconds. */
	private const int SAVE_PERIOD_SECONDS = 60;

	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private QualityService $service,
	) {
		parent::__construct($appName, $request);
	}

	/** Stores the quality values the browser measured and answers the file ids stored (ADR 0046). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/quality-values')]
	#[UserRateLimit(limit: self::SAVES_PER_PERIOD, period: self::SAVE_PERIOD_SECONDS)]
	public function save(array $values = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['saved' => $this->service->save($user, $values)]));
	}
}
