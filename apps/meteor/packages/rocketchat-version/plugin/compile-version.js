import { exec } from 'child_process';
import os from 'os';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);

class VersionCompiler {
	async processFilesForTarget(files) {
		const processFile = async function (file) {
			let output = JSON.parse(file.getContentsAsString());
			output.build = {
				date: new Date().toISOString(),
				nodeVersion: process.version,
				arch: process.arch,
				platform: process.platform,
				osRelease: os.release(),
				totalMemory: os.totalmem(),
				freeMemory: os.freemem(),
				cpus: os.cpus().length,
			};

			output.marketplaceApiVersion = require('@rocket.chat/apps-engine/package.json').version.replace(/^[^0-9]/g, '');
			const minimumClientVersions =
				JSON.parse(fs.readFileSync(path.resolve(process.cwd(), './package.json'), { encoding: 'utf8' }))?.rocketchat
					?.minimumClientVersions || {};
			try {
				const result = await execAsync("git log --pretty=format:'%H%n%ad%n%an%n%s' -n 1");
				const data = result.stdout.split('\n');
				output.commit = {
					hash: data.shift(),
					date: data.shift(),
					author: data.shift(),
					subject: data.join('\n'),
				};
			} catch (e) {
				if (process.env.NODE_ENV !== 'development') {
					throw e;
				}
				// no git
			}

			try {
				const tags = await execAsync('git describe --abbrev=0 --tags');
				if (output.commit) {
					output.commit.tag = tags.stdout.replace('\n', '');
				}
			} catch (e) {
				// no tags
			}

			try {
				const branch = await execAsync('git rev-parse --abbrev-ref HEAD');
				if (output.commit) {
					output.commit.branch = branch.stdout.replace('\n', '');
				}
			} catch (e) {
				if (process.env.NODE_ENV !== 'development') {
					throw e;
				}

				// no branch
			}

			file.addJavaScript({
				data: `exports.Info = ${JSON.stringify(output, null, 4)};
				exports.minimumClientVersions = ${JSON.stringify(minimumClientVersions, null, 4)};`,
				path: `${file.getPathInPackage()}.js`,
			});
		};

		for await (const file of files) {
			console.log('Processing file', file.getDisplayPath());
			switch (true) {
				case file.getDisplayPath().endsWith('rocketchat.info'): {
					await processFile(file);
					break;
				}
				case file.getDisplayPath().endsWith('rocketchat-supported-versions.info'): {
					// FOSS builds do not call releases.rocket.chat. Node's https.get
					// ignores HTTP(S)_PROXY, so a proxied or offline server fails the
					// whole meteor build on this request. Runtime already uses the
					// bundled list and does not phone home.
					file.addJavaScript({
						data: `exports.supportedVersions = {}`,
						path: `${file.getPathInPackage()}.js`,
					});
					break;
				}
				default: {
					throw new Error(`Unexpected file ${file.getDisplayPath()}`);
				}
			}
			console.log('Processed file', file.getDisplayPath());
		}
	}
}

Plugin.registerCompiler(
	{
		extensions: ['info'],
	},
	function () {
		return new VersionCompiler();
	},
);
