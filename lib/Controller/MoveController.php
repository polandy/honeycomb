<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidMoveRequestException;
use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\MoveTargetService;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class MoveController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private MoveService $moves,
		private MoveTargetService $targetFolders,
	) {
		parent::__construct($appName, $request);
	}

	/** Lists every child of each target folder, so the client can find conflicts (ADR 0018). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/move/targets')]
	public function targets(array $folders = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['folders' => $this->targetFolders->targets($user, $folders)]);
		} catch (InvalidMoveRequestException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}

	/** Moves each picture's files to their new paths and reports every file (ADR 0018). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/move')]
	public function move(array $pictures = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['pictures' => $this->moves->move($user, $pictures)]);
		} catch (InvalidMoveRequestException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		} catch (TrashBinDisabledException) {
			return new JSONResponse([], Http::STATUS_CONFLICT);
		}
	}
}
