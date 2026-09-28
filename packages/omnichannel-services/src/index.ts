import type { IOmnichannelTranscriptService, IQueueWorkerService, HealthAggResult } from '@rocket.chat/core-services';
import { ServiceClass } from '@rocket.chat/core-services';
import type { Logger } from '@rocket.chat/logger';

export class QueueWorker extends ServiceClass implements IQueueWorkerService {
	protected name = 'queue-worker';

	constructor(_db: unknown, loggerClass: typeof Logger) {
		super();
		void new loggerClass('QueueWorker');
	}

	async queueWork<T extends Record<string, unknown>>(_queue: 'work' | 'workComplete', _to: string, _data: T): Promise<void> {
		// FOSS stub: omnichannel background queues are not started.
	}

	async queueInfo(): Promise<HealthAggResult[]> {
		return [];
	}
}

export class OmnichannelTranscript extends ServiceClass implements IOmnichannelTranscriptService {
	protected name = 'omnichannel-transcript';

	constructor(loggerClass: typeof Logger, _i18n?: unknown) {
		super();
		void new loggerClass('OmnichannelTranscript');
	}

	async workOnPdf(_params: { details: { rid: string; userId: string; from: string } }): Promise<void> {
		// FOSS stub: PDF transcripts are a premium omnichannel feature.
	}
}
