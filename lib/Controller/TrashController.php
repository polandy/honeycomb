<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidTrashRequestException;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCA\Honeycomb\Service\TrashService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class TrashController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private TrashService $trash,
	) {
		parent::__construct($appName, $request);
	}

	/** Moves each picture's files into the trash bin and reports every file (ADR 0013). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/trash')]
	public function trash(array $pictures = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['pictures' => $this->trash->trash($user, $pictures)]);
		} catch (InvalidTrashRequestException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		} catch (TrashBinDisabledException) {
			return new JSONResponse([], Http::STATUS_CONFLICT);
		}
	}
}
