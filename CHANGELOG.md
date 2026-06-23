# Changelog

All notable changes to SNS MyAgent will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [0.1.0] - 2025-06-XX

### Added
- Conversational configuration (configure agent through chat)
- Token Budget Manager (TBM)
  - 3 communication modes: Caveman, Normal, Verbose
  - Context delta encoding (60-80% input token savings)
  - Multi-resolution context pyramid (5 levels)
  - Tool output auto-compress
  - Lazy skill loading
  - Conversation tombstoning
  - Response cache (exact + semantic match)
  - Token dashboard (`/tokens`)
- Memory system with 3 backends
  - Mnemosyne (default) — three-tier SQLite + FTS5
  - Mem0 — semantic with vector embeddings
  - LCM — latent context compression
- Self-configuration engine
  - Auto-install dependencies
  - Config file management
  - Connection validation
- MCP integration (Model Context Protocol)
- Skill system (markdown-based)
- Subagent delegation
- Cron scheduling
- Multi-provider LLM support (OpenAI, Anthropic, custom/local)
- Terminal REPL with markdown rendering

### Notes
- Forked from [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research
- Stripped to single-user terminal focus
- Removed: multi-platform messaging, desktop app, voice mode, multi-user support
