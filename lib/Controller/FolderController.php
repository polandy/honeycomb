<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Service\FolderService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class FolderController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private FolderService $folderService,
	) {
		parent::__construct($appName, $request);
	}

	/** The child folders of the folder at `path`, for the folder picker, counted with the `rawExtensions[]` and `renderedExtensions[]` sent. */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/folders')]
	public function index(string $path = ''): Response {
		return $this->api->forUser(function (IUser $user) use ($path): Response {
			$extensions = PairingExtensions::fromRequest($this->request->getParam('rawExtensions'), $this->request->getParam('renderedExtensions'));
			return new JSONResponse(['folders' => $this->folderService->children($user, $path, $extensions)]);
		});
	}
}
