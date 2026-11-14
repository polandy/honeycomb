<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidVisualHashException;
use OCA\Honeycomb\Service\VisualHashService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class VisualHashController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private VisualHashService $service,
	) {
		parent::__construct($appName, $request);
	}

	/** Stores the visual hashes the browser computed and answers the file ids stored (ADR 0024). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/visual-hashes')]
	public function save(array $hashes = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['saved' => $this->service->save($user, $hashes)]);
		} catch (InvalidVisualHashException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}
}
