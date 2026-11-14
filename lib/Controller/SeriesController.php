<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidSeriesException;
use OCA\Honeycomb\Service\SeriesService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class SeriesController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private SeriesService $service,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's stored series and kept-out files among the file ids (ADR 0027). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/series/lookup')]
	public function lookup(array $fileIds = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse($this->service->lookup($user, $fileIds));
		} catch (InvalidSeriesException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}

	/** Writes the whole states of the series, kept-out and released files given (ADR 0027). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/series')]
	public function save(array $series = [], array $keptOut = [], array $released = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse($this->service->save($user, $series, $keptOut, $released));
		} catch (InvalidSeriesException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}
}
