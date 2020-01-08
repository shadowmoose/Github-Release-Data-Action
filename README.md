# Updater-Action

GitHub Action to build a more complete JSON file representing the latest release to a Repo.

Attaches pre-processed data about each release artifact, including UTC timestamps and hashes.

## To use:
```yml
- name: Build Release JSON Data
  uses: shadowmoose/Github-Release-Data-Action@1.0.0
  id: release_json
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    owner: ShadowMoose  # Optional. Defaults to current.
    repo: Test  # Optional. Defaults to current.
    outFile: './output/release.json'  # -- Optional. Defaults to no file output.
```


Then, later, you may use the outputs like this:

```yml
- name: Get the output time
  run: |
    echo "Latest tag: ${{ steps.release_json.outputs.latest_release }}";
    echo "Release data: ${{ steps.release_json.outputs.data_json }}";
```
