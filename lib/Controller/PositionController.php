<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidPositionException;
use OCA\Honeycomb\Service\PositionService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class PositionController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private PositionService $positions,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's resume positions, the latest saved first (ADR 0012). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/positions')]
	public function index(): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		return new JSONResponse(['positions' => $this->positions->recent($user)]);
	}

	/** Stores where the user stands in the folder set (ADR 0012). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/positions')]
	public function save(array $folderSet = [], int $fileId = 0, int $decided = 0, int $total = 0): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse($this->positions->save($user, $folderSet, $fileId, $decided, $total));
		} catch (InvalidPositionException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}
}
