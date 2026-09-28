export class Utilities {
	static getI18nKeyForApp<TKey extends string, TAppId extends string>(key: TKey, appId: TAppId) {
		return `app-${appId}.${key}` as const;
	}

	static curl(
		{
			method,
			params,
			auth,
			headers = {},
			url,
			query,
			content,
		}: {
			method: string;
			params?: Record<string, string>;
			auth?: string;
			headers?: Record<string, string>;
			url: string;
			query?: Record<string, string>;
			content?: unknown;
		},
		opts: {
			verbose?: boolean;
			headers?: boolean;
		} = {},
	) {
		const newLine = '\\\n   ';
		const cmd = ['curl'];

		if (opts.verbose) {
			cmd.push('-v');
		}
		if (opts.headers) {
			cmd.push('-i');
		}

		cmd.push('-X');
		cmd.push((method || 'GET').toUpperCase());

		let u = url;
		if (typeof params === 'object') {
			Object.entries(params).forEach(([key, value]) => {
				u = u.replace(`:${key}`, value);
			});
		}

		if (typeof query === 'object') {
			const queryString = Object.entries(query)
				.map(([key, value]) => `${key}=${value}`)
				.join('&');
			u += `?${queryString}`;
		}
		cmd.push(u);

		if (auth) {
			cmd.push(newLine, '-u', auth);
		}

		const headerKeys: string[] = [];
		Object.entries(headers).forEach(([key, val]) => {
			const headerKey = key.toLowerCase();
			headerKeys.push(headerKey);
			cmd.push(newLine, '-H', `"${headerKey}${val ? ': ' : ';'}${val || ''}"`);
		});

		if (content) {
			let body: unknown = content;
			if (typeof content === 'object') {
				if (!headerKeys.includes('content-type')) {
					cmd.push(newLine, '-H', '"content-type: application/json"');
				}
				body = JSON.stringify(content);
			}

			cmd.push(newLine, '--data-binary', `'${body}'`);
		}

		return cmd.join(' ');
	}
}
