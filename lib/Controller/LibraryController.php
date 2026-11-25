<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Domain\DoneSkip;
use OCA\Honeycomb\Domain\FolderDone;
use OCA\Honeycomb\Service\Folder\FolderDoneService;
use OCA\Honeycomb\Service\Folder\LibraryFolderService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class LibraryController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private LibraryFolderService $library,
		private FolderDoneService $done,
	) {
		parent::__construct($appName, $request);
	}

	/** One page of the summarised folders below `$root`, with the user's live decisions (FOLDERS-005). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/library/folders')]
	public function folders(string $root, string $cursor = '', string $limit = ''): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->library->list($user, $root, $cursor, $limit)));
	}

	/** Summarises the next batch of folders below `$root` that changed since their last scan (FOLDERS-005.5). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/library/scan')]
	public function scan(string $root): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->library->scan($user, $root)));
	}

	/** Marks the folder done by the user, as of `$photos` photos (FOLDERS-006.1). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/library/folders/{fileId}/done')]
	public function markDone(int $fileId, mixed $photos = null): Response {
		return $this->api->forUser(function (IUser $user) use ($fileId, $photos): Response {
			return new JSONResponse(self::doneRow($this->done->mark($user, $fileId, $photos)));
		});
	}

	/** Reopens the folder, also when it is not done (FOLDERS-006.3). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'DELETE', url: '/api/v1/library/folders/{fileId}/done')]
	public function reopen(int $fileId): Response {
		return $this->api->forUser(function (IUser $user) use ($fileId): Response {
			$this->done->reopen($user, $fileId);
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}

	/** Marks each rateable folder of `$folders` done that is not, skipping the others with the reason (FOLDERS-006.15). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/library/done')]
	public function markAllDone(mixed $folders = null): Response {
		return $this->api->forUser(function (IUser $user) use ($folders): Response {
			$batch = $this->done->markAll($user, $folders);
			return new JSONResponse([
				'done' => array_map(self::doneRow(...), $batch->done),
				'skipped' => array_map(static fn (int $fileId, DoneSkip $reason): array => ['fileId' => $fileId, 'reason' => $reason->value], array_keys($batch->skipped), $batch->skipped),
			]);
		});
	}

	/** Reopens each folder of `$fileIds`, also one that is not done (FOLDERS-006.18). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'DELETE', url: '/api/v1/library/done')]
	public function reopenAll(mixed $fileIds = null): Response {
		return $this->api->forUser(function (IUser $user) use ($fileIds): Response {
			$this->done->reopenAll($user, $fileIds);
			return new Response(Http::STATUS_NO_CONTENT);
		});
	}

	/**
	 * The folder's done row as the list shows it (FOLDERS-006.1).
	 * @return array{fileId: int, done: array{by: ?string, at: int, photos: int}}
	 */
	private static function doneRow(FolderDone $done): array {
		return ['fileId' => $done->fileId, 'done' => ['by' => $done->userId, 'at' => $done->doneAt, 'photos' => $done->photos]];
	}
}
