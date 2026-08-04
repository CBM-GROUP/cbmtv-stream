# Security

## Environment Files

This project uses local environment files for configuration.

The following files **must never be committed** to Git:

- `.env`
- `.env.production`
- `.env.local`
- any other environment file containing secrets

These files contain sensitive configuration such as API keys, tokens, passwords, and deployment credentials.

Developers should instead copy:

```text
.env.example
```

to:

```text
.env
```

and fill in their own local values.

---

## Git Ignore Policy

The repository intentionally ignores environment files.

Example:

```gitignore
.env
.env.*
!.env.example
```

Only `.env.example` should be committed.

---

## Secret Management

Secrets should never be stored in:

- source code
- committed configuration files
- documentation
- pull requests

Production credentials should be managed through the hosting platform's environment variable system.

---

## Repository Security Cleanup

On **4 August 2026**, the repository underwent a security cleanup after it was discovered that environment files had previously been committed.

The cleanup included:

- removing `.env` from Git tracking
- removing `.env.production` from Git tracking
- adding `.env.example`
- updating `.gitignore`
- rewriting Git history to remove historical environment files
- verifying the repository no longer exposes those files in reachable history
- recreating the local development clone from the cleaned repository

This cleanup was performed to align the repository with standard Git security practices.

---

## If Secrets Are Accidentally Committed

If a secret is committed:

1. Remove it from Git tracking immediately.
2. Rotate the affected credential.
3. Assess whether a history rewrite is necessary.
4. Inform the repository maintainers.
5. Never assume deleting the file alone is sufficient.

---

## Development Checklist

Before every push:

- [ ] `.env` is not staged.
- [ ] `.env.production` is not staged.
- [ ] No API keys are committed.
- [ ] No passwords or tokens are committed.
- [ ] `.env.example` reflects any newly required variables.
