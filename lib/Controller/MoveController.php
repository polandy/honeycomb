<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\MoveService;
use OCA\Honeycomb\Service\MoveTargetService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class MoveController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private MoveService $moves,
		private MoveTargetService $targetFolders,
	) {
		parent::__construct($appName, $request);
	}

	/** Lists every child of each target folder, so the client can find conflicts (ADR 0018). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/move/targets')]
	public function targets(array $folders = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['folders' => $this->targetFolders->targets($user, $folders)]));
	}

	/** Moves each picture's files to their new paths and reports every file (ADR 0018). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/move')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function move(array $pictures = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['pictures' => $this->moves->move($user, $pictures)]));
	}
}
