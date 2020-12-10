# Updater-Action

This GitHub action builds a rolling log file, containing in-depth details for the assets attached to the latest release.
As new releases are made with their own assets, their data will be prepended to this file automatically.

The output file will be pushed into a new, empty data branch within the target repository.
This data file (JSON) can then be read by your external program in order to check for updates without needing to use the GitHub API.

Notable improvements over the GitHub API:
+ Attaches pre-processed data about each release artifact, including UTC timestamps and hashes.
+ No rate-limiting for access - simply use the static file URL.
+ Easy to bundle with your application or redistribute, if desired.


## To use:
```yml
- name: Build Release JSON Data
  uses: shadowmoose/Github-Release-Data-Action@4.0.0
  id: release_json
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    owner: ShadowMoose  # Optional. Defaults to current.
    repo: Test  # Optional. Defaults to current.
    outFile: 'release-info.json'  # -- Optional.
    outBranch: release-metadata  # Optional.
```

*Not all options are included above. Check out [the options](./action.yml) for more optional customization, including setting size limits and custom release tags.*


## Sample Output:
Once run, this Action will generate a new branch names something like "release-data" (customizable). This branch will contain a json file, which will look something like this:
```json5
[ // Array of release objects, with the newest first:
{
  "url": "https://api.github.com/repos/shadowmoose/RedditDownloader/releases/28461164",
  "assets_url": "https://api.github.com/repos/shadowmoose/RedditDownloader/releases/28461164/assets",
  "upload_url": "https://uploads.github.com/repos/shadowmoose/RedditDownloader/releases/28461164/assets{?name,label}",
  "html_url": "https://github.com/shadowmoose/RedditDownloader/releases/tag/3.1.1",
  "id": 28461164,
  "author": {
    "login": "shadowmoose",
    "id": 774862,
    "node_id": "MDQ6VXNlcjc3NDg2Mg==",
    "avatar_url": "https://avatars3.githubusercontent.com/u/774862?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/shadowmoose",
    "type": "User",
    "site_admin": false
  },
  "node_id": "MDc6UmVsZWFzZTI4NDYxMTY0",
  "tag_name": "3.1.1",
  "target_commitish": "master",
  "name": "Release 3.1.1 - Windows Binary Fix",
  "draft": false,
  "prerelease": false,
  "created_at": "2020-07-11T00:23:49Z",
  "published_at": "2020-07-11T00:29:54Z",
  "assets": [
    {
      "url": "https://api.github.com/repos/shadowmoose/RedditDownloader/releases/assets/29325295",
      "id": 29325295,
      "node_id": "MDEyOlJlbGVhc2VBc3NldDI5MzI1Mjk1",
      "name": "RMD-macOS",
      "label": "",
      "uploader": {
        // Uploader user data...
      },
      "content_type": "binary/octet-stream",
      "state": "uploaded",
      "size": 23280993,
      "download_count": "?",
      "created_at": "2020-12-09T01:03:03Z",
      "updated_at": "2020-12-09T01:03:04Z",
      "browser_download_url": "https://github.com/shadowmoose/RedditDownloader/releases/download/3.1.1/RMD-macOS",
      "metadata": {  // Custom data - contains hashes for each binary asset attached to a release.
        "updatedMS": 1607475784000,
        "updated": 1607475784,
        "sha1": "00c767afd690eb8e4cf9212731563067eebccd41",
        "sha256": "3254b173cba1fed487360c25daee62d50bd5f8b6b626c32e57aa3e3c5b0ab749",
        "md5": "969414ae731060816710435237e44f19"
      }
    },
    //... More release assets here
  ],
  "tarball_url": "https://api.github.com/repos/shadowmoose/RedditDownloader/tarball/3.1.1",
  "zipball_url": "https://api.github.com/repos/shadowmoose/RedditDownloader/zipball/3.1.1",
  "body": "The release notes.",
  "published_utc": 1594427394
},
// next-oldest relese, etc...
]
```

This action also has some outputs for Workflow util. You may use the [outputs](./action.yml) like this:

```yml
- name: Get the output time
  run: |
    echo "Latest tag: ${{ steps.release_json.outputs.latest_release }}";
    echo "Released: ${{ steps.release_json.outputs.is_released }}";
```
