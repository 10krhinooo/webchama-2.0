# Changelog

All notable changes to this project will be documented in this file.

## [unreleased] - 2026-08-07

### Added
- dark mode, selectable per user and following the operating system by default
- a semantic colour token layer, so a theme is defined in one place rather than written into
  each component
- automatically flip a chama to inactive after a period of no contributions
- let a chairperson edit the savings goal and welfare fund target from the chama dashboard

### Fixed
- db: generate a join_code for each chama in the dev demo seed
- frontend: surface errors when the loan repayment schedule fails to load
