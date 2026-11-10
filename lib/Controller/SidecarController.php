<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\InvalidSidecarRequestException;
use OCA\Honeycomb\Service\SidecarReader;
use OCA\Honeycomb\Service\SidecarWriter;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class SidecarController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private SidecarReader $reader,
		private SidecarWriter $writer,
	) {
		parent::__construct($appName, $request);
	}

	/** Answers the bytes of each listed sidecar (ADR 0017). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/sidecars/lookup')]
	public function lookup(array $fileIds = []): JSONResponse {
		return $this->answer(fn (IUser $user): array => $this->reader->lookup($user, $fileIds));
	}

	/** Saves each sidecar by the checked save (ADR 0017). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/sidecars')]
	public function save(array $sidecars = []): JSONResponse {
		return $this->answer(fn (IUser $user): array => $this->writer->save($user, $sidecars));
	}

	/** @param \Closure(IUser): list<array<string, mixed>> $handle */
	private function answer(\Closure $handle): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		try {
			return new JSONResponse(['sidecars' => $handle($user)]);
		} catch (InvalidSidecarRequestException) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
	}
}
