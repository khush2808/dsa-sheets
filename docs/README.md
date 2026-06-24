# Project Knowledge Base

This folder is the working memory for the DSA Sheets project: architecture notes, implementation decisions, and future plans that should survive across coding sessions.

## Start Here

- [Architecture](./architecture.md) explains the current static-site shape, shared UI, data files, and progress storage boundary.
- [Auth and Backend Plan](./auth-backend-plan.md) captures the recommended stack for moving saved progress and notes from localStorage to user accounts.

## Current Direction

The app should stay low-ops and easy to deploy. Prefer managed services and Git-backed deployment so future agents can implement, push, and let the hosting platform deploy without the owner having to run infrastructure manually.

