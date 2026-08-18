# SNS-MyAgent — Agent Skills Reference

## Prerequisite Skills (ALL INSTALLED via skills.sh)

### Core Infrastructure
- **subagent-driven-development** — sub-agent workflow orchestration
- **dispatching-parallel-agents** — parallel agent spawning  
- **agent-browser** — browser automation agent
- **mnemosyne-native-memory** — SQLite-backed 3-tier memory (episodic/semantic/procedural)

### UI/UX & Frontend Quality (NO AI SLOP)
- **taste-skill** (leonxlnx) — design taste, high-end visual design, minimalist UI, industrial brutalist
- **impeccable** (pbakaus) — polish, critique, audit, animate, optimize, colorize
- **ui-ux-pro-max** (nextlevelbuilder) — promax UI/UX
- **frontend-design** (anthropics) — Claude-grade frontend design
- **web-quality-skills** (addyosmani) — accessibility, core-web-vitals, performance, SEO

### Backend & Database
- **nodejs-backend-patterns** (wshobson) — backend best practices
- **supabase** + **supabase-postgres-best-practices** — database skill
- **golang-security** + **golang-database** (samber) — security & DB patterns
- **postgresql-table-design** — database schema design

### Security
- **golang-security** — secure coding patterns
- **secrets-management** — credential handling
- **sast-configuration** — static analysis
- **anti-reversing-techniques** — reverse engineering defense

## Memory System: Mnemosyne Native
- 3-tier: episodic/semantic/procedural (SQLite + FTS5)
- Source: `src/memory-backend/mnemosyne-backend.ts`
- Consolidation threshold: 50 episodic → auto-merge to semantic

## MCP: NeedMCP
- Provider: `https://api.needmcp.com/v1`
- Key: `NEED_MCP_API_KEY` in `/opt/data/.env.local`

## Quality Standards
- All UI MUST meet "impeccable" bar — NO AI SLOP
- Backend MUST follow nodejs-backend-patterns
- DB MUST follow supabase-postgres-best-practices
