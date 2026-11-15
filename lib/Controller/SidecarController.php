<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\SidecarReader;
use OCA\Honeycomb\Service\SidecarWriter;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class SidecarController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private SidecarReader $reader,
		private SidecarWriter $writer,
	) {
		parent::__construct($appName, $request);
	}

	/** Answers the bytes of each listed sidecar (ADR 0017). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/sidecars/lookup')]
	public function lookup(array $fileIds = []): Response {
		return $this->answer(fn (IUser $user): array => $this->reader->lookup($user, $fileIds));
	}

	/** Saves each sidecar by the checked save (ADR 0017). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/sidecars')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(array $sidecars = []): Response {
		return $this->answer(fn (IUser $user): array => $this->writer->save($user, $sidecars));
	}

	/** @param \Closure(IUser): list<array<string, mixed>> $handle */
	private function answer(\Closure $handle): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['sidecars' => $handle($user)]));
	}
}
