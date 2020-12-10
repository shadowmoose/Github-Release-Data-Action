# Updater-Action

This GitHub action builds a rolling log file, containing in-depth release details for the latest release and past history.

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

*Not all options are included above. Check out [the options](./action.yml) for more customization.*


This action also has some outputs for Workflow util. You may use the [outputs](./action.yml) like this:

```yml
- name: Get the output time
  run: |
    echo "Latest tag: ${{ steps.release_json.outputs.latest_release }}";
    echo "Released: ${{ steps.release_json.outputs.is_released }}";
```
