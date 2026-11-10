<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\ListingService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class EntryController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private ListingService $listingService,
	) {
		parent::__construct($appName, $request);
	}

	/** The entries of the folder at `path`, with `subfolders=1` of every folder below too. */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/entries')]
	public function index(string $path = '', bool $subfolders = false): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse($this->listingService->list($user, $path, $subfolders));
		} catch (FolderNotFoundException) {
			return new JSONResponse([], Http::STATUS_NOT_FOUND);
		} catch (FolderNotReadableException) {
			return new JSONResponse([], Http::STATUS_FORBIDDEN);
		}
	}
}
