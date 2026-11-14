// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WorkerAnswer, WorkerRequest } from './hash-workers.ts'

import { hashFetched } from './hash-drawing.ts'

/** The worker's global scope; the app's TypeScript knows only the DOM's. */
const scope = self as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null, postMessage: (answer: WorkerAnswer) => void }

const seams = {
	fetch: (url: string) => fetch(url, { credentials: 'same-origin' }),
	decode: (blob: Blob) => createImageBitmap(blob),
	canvas: (width: number, height: number) => new OffscreenCanvas(width, height),
}

scope.onmessage = ({ data }) => {
	hashFetched(data.url, seams).then(
		(hash) => scope.postMessage({ id: data.id, hash }),
		(error: unknown) => scope.postMessage({ id: data.id, error }),
	)
}
