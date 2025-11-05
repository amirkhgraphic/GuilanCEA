# GuilanCEA Platform

This repository contains the services that power the GuilanCEA platform. The project is orchestrated with Docker Compose and can be deployed either locally or from CI/CD using the same helper script.

## Deployment

The `scripts/deploy.sh` script encapsulates the production deployment procedure so that the same command can be executed locally or from GitHub Actions.

```bash
# Ensure the production environment variables are available in .env.production
scripts/deploy.sh
```

By default the script looks for `.env.production` in the repository root. To use a different file, export the `ENV_FILE` environment variable before running the script:

```bash
ENV_FILE=/path/to/production.env scripts/deploy.sh
```

The script runs the following commands against the root `docker-compose.yml` file:

1. `docker compose pull`
2. `docker compose up -d --remove-orphans`

### GitHub Actions deploy job

The `.github/workflows/deploy.yml` workflow calls `scripts/deploy.sh` directly to ensure that CI deployments mirror local rollouts. Configure the `PRODUCTION_ENV_FILE` secret in the repository with the contents of the production `.env` file so the workflow can recreate `.env.production` during the deploy job.

