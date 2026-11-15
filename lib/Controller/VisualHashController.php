<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\MissingVisualHashes;
use OCA\Honeycomb\Service\VisualHashService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class VisualHashController extends Controller {
	/** Saves a user may send per period, well above a strong computer's full run (ADR 0026). */
	private const int SAVES_PER_PERIOD = 300;
	/** The period of the save limit in seconds. */
	private const int SAVE_PERIOD_SECONDS = 60;

	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private VisualHashService $service,
		private MissingVisualHashes $missing,
	) {
		parent::__construct($appName, $request);
	}

	/** Stores the visual hashes the browser computed and answers the file ids stored (ADR 0024). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/visual-hashes')]
	#[UserRateLimit(limit: self::SAVES_PER_PERIOD, period: self::SAVE_PERIOD_SECONDS)]
	public function save(array $hashes = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['saved' => $this->service->save($user, $hashes)]));
	}

	/** The next page of the user's photos below `$path` without a hash of their current etag (ADR 0025). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/visual-hashes/missing')]
	public function missing(string $path = '', string $after = ''): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->missing->page($user, $path, $after)));
	}
}
