# Security and privacy

SimmerSync reads a local YAML or JSON plan and writes local files. The CLI:

- has no network code, account system, analytics, telemetry, cookies, or remote fonts;
- never executes plan text as code;
- escapes user text in CSV, ICS, terminal, and HTML outputs;
- embeds Cook Mode data as inert JSON and applies a restrictive Content Security Policy;
- stores completed Cook Mode checkboxes only in the browser's local storage.

The generated HTML intentionally uses inline CSS and JavaScript so it remains one offline file.
Its CSP permits only those inline blocks and denies network resources.

Treat imported plans as data, review cooking directions yourself, and follow authoritative food
safety guidance. SimmerSync schedules declared durations; it does not determine safe internal
temperatures, allergens, or whether a recipe is sound.

Report a suspected vulnerability privately through GitHub's security advisory feature. Do not
include real addresses, private meal notes, or other personal data in a public issue.
