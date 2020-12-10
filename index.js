const github = require('@actions/github');
const core = require('@actions/core');
const exec = require('@actions/exec');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');


const token = core.getInput('token');
const userReleaseTag = core.getInput('releaseTag').trim();
const owner = core.getInput('owner') || github.context.payload.repository.owner.name;
const repo = core.getInput('repo') || github.context.payload.repository.name;
const outFile = core.getInput('outFile').replace(/^[./]+/gmi, '');
const branch = core.getInput('outBranch') || null;
const maxReleases = parseInt(core.getInput('madReleases'));
const octokit = new github.GitHub(token);

const oldDir = path.resolve(process.cwd());
const newDir = path.resolve('../blank-repo');


async function run() {
	const lRes = userReleaseTag ? await octokit.repos.getReleaseByTag({
		owner, repo, tag: userReleaseTag
	})  : await octokit.repos.getLatestRelease({owner, repo});
	if (!lRes) {
		core.warning('No valid release could be located!');
		process.exit(1);
	}
	const release = lRes.data;
	const releaseTag = release.tag_name;

	core.info(`Latest Release tag: ${releaseTag}`);

	const proms = release.assets.map(async a => {
		const url = a.browser_download_url;
		const ext = {
			updatedMS: new Date(a.updated_at).getTime(),
			updated: Math.floor(new Date(a.updated_at).getTime() / 1000)
		};
		core.info(`Checking release asset: ${a.name} -> ${url}`);

		await download(token, a, owner, repo, a.name);

		const hashes = await Promise.all(
			['sha1', 'sha256', 'md5'].map(async hashType => {
				return [hashType, await hash(a.name, hashType)];
			})
		);

		for (const h of hashes) {
			ext[h[0]] = h[1]  // Assign in this way, to preserve key order in output JSON.
		}

		a.metadata = ext;
		delete a.download_count;  // This often changes, so preserve a constant value instead.
		core.info(`Processed asset: ${a.name}`);
	});

	await Promise.all(proms);

	release.published_utc = Math.floor(new Date(release.published_at).getTime()/1000);

	core.setOutput("data_json", JSON.stringify(release, null, 2));
	core.setOutput("latest_release", releaseTag);
	core.setOutput("is_released", `${!(release.prerelease || release.draft)}`);

	// Initialize a new Git Repo:
	await exec.exec('git', ['init']);
	await exec.exec('git', ['remote', 'add', 'origin', `https://${owner}:${token}@github.com/${owner}/${repo}.git`]);
	await exec.exec('git', ['config', 'user.email', 'gh-release-bot@github.com']);
	await exec.exec('git', ['config', 'user.name', 'gh-release-bot']);
	await exec.exec('git', ['fetch', 'origin', branch]).catch(_err=>{});

	// Either checkout an existing branch, or build a brand new orphan branch:
	try {
		await exec.exec('git', ['checkout', branch]);
		core.info('Pulled existing git branch.')
	} catch(err) {
		core.warning(`Data Branch "${branch}" does not exist! Creating new orphan...`);
		await exec.exec('git', ['checkout', '--orphan' , branch]);
		core.info("Created orphan branch");
	}

	// Load all files, as they are on the server:
	await exec.exec('git', ['reset', '--hard', `origin/${branch}`]).catch(_err => {});

	// Prepare the output data:
	let data = [];
	if (fs.existsSync(outFile)) {
		// Load from existing data file, if one exists:
		data = JSON.parse(fs.readFileSync(outFile).toString());
		core.info(`Existing release count: ${data.length}`);
	}
	data = data.filter(d => d.tag_name !== release.tag_name);
	data.unshift(release);

	data = data.sort((d1, d2) => d2.published_utc - d1.published_utc)

	if (data.length > maxReleases) {
		data = data.slice(0, maxReleases);
	}
	core.info(`New release count: ${data.length}`);

	// Write file:
	const json = JSON.stringify(data, null, 2);
	fs.mkdirSync(path.dirname(outFile), {recursive: true});
	fs.writeFileSync(outFile, json);

	// Push (only this specific data file) back to GH, if there were changes:
	await exec.exec('git', ['reset']);
	await exec.exec('git', ['add', outFile]);
	await exec.exec('git', ['diff' ,'--exit-code', '--cached', '--quiet']).then(() => {
		core.info('No changes. Finished!');
	}).catch( async() => {
		core.info('New data. Building commit...')
		await exec.exec('git', ['commit', '-m', `Auto-generated on ${new Date().toLocaleDateString()} for release ${releaseTag}`]);
		await exec.exec('git', ['push', 'origin', branch]);
		core.info('Pushed changes!');
	});
}

const download = async (token, asset, owner, repo, dest) => {
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

// Jump into new directory, to isolate from existing project.
fs.mkdirSync(newDir, {recursive: true});
process.chdir(newDir);

// Run, then cleanup the temp directory:
run().catch(err => {
	core.setFailed(`${err}`);
}).finally(() => {
	process.chdir(oldDir);
	fs.rmdirSync(newDir, {recursive: true});
});
