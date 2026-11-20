<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\IUser;

/** The rows the browser computed per file version that belong to a photo the user reaches at that version. */
final class CurrentRows {
	/**
	 * The rows whose file the user reaches as a photo at the row's etag, in order.
	 * @template T of VisualHash|QualityValue
	 * @param list<T> $rows each of another file
	 * @return list<T>
	 */
	public static function of(UserPhotos $photos, IUser $user, array $rows): array {
		$etags = [];
		foreach ($rows as $row) {
			$etags[$row->fileId] = $row->etag;
		}
		$isCurrent = array_flip($photos->current($user, $etags));
		return array_values(array_filter($rows, static fn (VisualHash|QualityValue $row): bool => isset($isCurrent[$row->fileId])));
	}
}
