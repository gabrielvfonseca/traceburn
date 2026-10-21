# Security

## Reporting vulnerabilities

Please report security vulnerabilities privately to the project maintainer. Do not file public issues for security concerns.

## Supply chain

Dependencies are pinned via `package-lock.json`. Changesets are used for versioned releases. Review dependency changes in pull requests before merging.

## Data handling

`agentburn` reads agent execution traces locally. Tool arguments and results may contain sensitive information. Findings include evidence excerpts from the trace — consider redacting traces before sharing them in public issues or CI artifacts.

Pricing estimates use a built-in, date-stamped table and never transmit usage data externally.
