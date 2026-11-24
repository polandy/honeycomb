// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WorkerAnswer, WorkerRequest } from './hash-workers.ts'

import { hashFetched } from './hash-drawing.ts'
import { measureById } from './quality-measures.ts'

/** The worker's global scope; the app's TypeScript knows only the DOM's. */
const scope = self as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null, postMessage: (answer: WorkerAnswer) => void }

const seams = {
	fetch: (url: string) => fetch(url, { credentials: 'same-origin' }),
	decode: (blob: Blob) => createImageBitmap(blob),
	canvas: (width: number, height: number) => new OffscreenCanvas(width, height),
}

scope.onmessage = ({ data }) => {
	const answer = data.kind === 'hash'
		? hashFetched(data.url, seams).then((hash) => ({ id: data.id, hash }))
		: Promise.resolve().then(() => measureById(data.kind).measure(data.url, seams)).then((measured) => ({ id: data.id, measured }))
	answer.then(
		(done) => scope.postMessage(done),
		(error: unknown) => scope.postMessage({ id: data.id, error }),
	)
}
