<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\Settings\SettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class SettingsController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private SettingsService $settings,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's stored settings object (ADR 0014). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/settings')]
	public function index(): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['settings' => $this->settings->get($user)]));
	}

	/** Stores the user's whole settings object (ADR 0014). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/settings')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(mixed $settings = null): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['settings' => $this->settings->save($user, $settings)]));
	}

	/** Stores one of the user's settings lists whole under its own key (ADR 0051). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/settings/lists/{name}')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function saveList(string $name, mixed $items = null): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['items' => $this->settings->saveList($user, $name, $items)]));
	}
}
