const github = require('@actions/github');
const core = require('@actions/core');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');


async function run() {
	const token = core.getInput('token');
	const owner = core.getInput('owner') || github.context.payload.repository.owner.name;
	const repo = core.getInput('repo') || github.context.payload.repository.name;
	const outFile = core.getInput('outFile') || null;
	const octokit = new github.GitHub(token);
	const release = (await octokit.repos.getLatestRelease({owner, repo})).data;
	const releaseTag = release.tag_name;

	core.info(`Latest Release tag: ${releaseTag}`);

	const proms = release.assets.map(async a => {
		const url = a.browser_download_url;
		const ext = {
			updatedMS: new Date(a.updated_at).getTime(),
			updated: Math.floor(new Date(a.updated_at).getTime() / 1000)
		};
		core.info(`Checking release asset: ${a.name} -> ${url}`);

		await download(token, a, owner, repo, a.name, core);

		await Promise.all(
			['sha1', 'sha256', 'md5'].map(async hashType => {
				ext[hashType] = await hash(a.name, hashType);
			})
		);

		a.metadata = ext;
		core.info(`Processed asset: ${a}`);
	});

	await Promise.all(proms);

	release.published_utc = Math.floor(new Date(release.published_at).getTime()/1000);

	core.setOutput("data_json", JSON.stringify(release, null, 2));
	core.setOutput("latest_release", releaseTag);
	core.setOutput("is_released", !(release.prerelease || release.draft));

	if (outFile) {
		const file = path.resolve(outFile);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(release, null, 2));
	}
}


const download = async (token, asset, owner, repo, dest, core) => {
	const url = await new Promise((res, rej) => {
		const options = {
			hostname: 'api.github.com',
			path: `/repos/${owner}/${repo}/releases/assets/${asset.id}`,
			headers: {
				Accept: 'application/octet-stream',
				'User-Agent': 'GH-Updater-Action-Client',
				Authorization: `token ${token}`
			}
		};
		https.get(options, function(response) {
			if (response.statusCode !== 302) {
				rej(`Error: Server failed to redirect (${response.statusCode}) for asset ${asset.name}!`);
			}
			res(response.headers.location);
		}).on('error', function(err) {
			rej(err.message);
		});
	});

	return new Promise((res, rej) => {
		const file = fs.createWriteStream(dest);
		https.get(url, function(response) {
			if (response.statusCode !== 200) {
				rej(`Error: Server responded with code ${response.statusCode} for asset ${asset.name}!`);
			}
			file.on('finish', function() {
				file.close(res);
			});
			response.pipe(file);
		}).on('error', function(err) {
			rej(err.message);
		});
	});
};



function hash(file, algorithm = 'sha256') {
	return new Promise( res => {
		const shasum = crypto.createHash(algorithm);
		const filename = file, s = fs.createReadStream(filename);
		s.on('data', function (data) {shasum.update(data)});
		s.on('end', function () {res(shasum.digest('hex'))});
	});
}


run().catch(err => {
	core.setFailed(`${err}`);
});
