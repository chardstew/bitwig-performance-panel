# Release checklist

## Source

- Working tree contains only intended release changes.
- Extension version, changelog, protocol example, and visible alpha label agree.
- `./scripts/test.sh` passes on the release revision.
- `./scripts/package.sh` produces one ZIP containing the extension, README,
  changelog, and license.
- The release artifact installs into a clean Bitwig configuration.

## Bitwig verification

Test an empty project, a normal working project, and a large project.

- Controller activation and removal are clean; no duplicate entry remains.
- Navigator follows selection and wraps tracks, devices, and pages correctly.
- Remote values update in both directions, including toggle controls.
- Add, remove, reorder, save, reopen, and restart with pinned pages.
- Add selected/all mixer tracks; verify pan, level, meter, mute, solo, and arm.
- Verify every mixer placement and width, with Navigator at top and bottom.
- Switch projects and confirm each project's layout and pinned content return.
- Verify hotkeys do not fire while editing text or another control.
- Verify the fixed status rail, Chrome tab, and installed Chrome app window.

## Performance

Record Bitwig CPU and UI responsiveness for each test project:

- before enabling the controller;
- controller active with no browser panel open;
- panel open with no pinned pages or mixer tracks;
- panel open with 32 pinned pages and 32 mixer tracks.

Note startup spikes separately from steady-state use. Investigate regressions
before raising page, mixer, track-scan, or device-scan limits.

## Compatibility

- Record the tested Bitwig, operating system, and Chrome versions.
- Do not claim Windows or Linux support until installation and runtime are tested
  there; invite reports instead.
- Confirm the documented drag installation works. Test the platform-specific
  install script only on platforms named by the release notes.

## Publication

- Publish from a clean, curated Git history.
- Create a GitHub pre-release and attach the ZIP from `dist/`.
- Attach the generated `.sha256` file and include tested versions and known
  limits in release notes.
- Verify README links from the public repository.
- Point the website's download, documentation, and issue links to GitHub; do not
  host a second release binary or duplicate technical documentation.
