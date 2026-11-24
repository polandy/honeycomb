<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\Settings\ViewStateService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class ViewStateController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private ViewStateService $viewState,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's view state, null for a key never stored (ADR 0019). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/view-state')]
	public function index(): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['viewState' => $this->viewState->get($user)]));
	}

	/** Stores the keys of the view state given (ADR 0019). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/view-state')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(mixed $viewState = null): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['viewState' => $this->viewState->save($user, $viewState)]));
	}
}
