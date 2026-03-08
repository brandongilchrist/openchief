# OpenChief Multi-Provider LLM - Linear Task Structure

**Project:** OpenChief Multi-Provider Support  
**Repository:** https://github.com/brandongilchrist/openchief  
**Status:** ✅ Implementation Complete, Tasks for Testing & Deployment

---

## Epic: Multi-Provider LLM Integration

**Description:**
Extend OpenChief to support multiple LLM providers beyond Anthropic Claude, with focus on subscription-based services (OAuth + CLI). Enable flexible provider selection for dev vs production environments.

**Goals:**
- Support 4 providers: Anthropic (OAuth-ready), GLM, Gemini CLI, Codex CLI
- Maintain backwards compatibility
- Enable cost optimization (GLM at $10/mo vs $20/mo alternatives)
- Create extensible provider architecture

**Links:**
- Repository: https://github.com/brandongilchrist/openchief
- Commits: 8e7a6e6, 596ef2e, 0ad6201
- Documentation: docs/MULTI_PROVIDER_SETUP.md

---

## Main Task: Multi-Provider LLM Architecture

**Status:** ✅ Done  
**Priority:** High  
**Assignee:** Operator (completed autonomously)  
**Estimate:** 4h → Actual: 3h

**Description:**
Build provider abstraction layer and implement 4 LLM providers with unified API.

**Acceptance Criteria:**
- [x] Abstract base class defining provider interface
- [x] Anthropic provider with OAuth preparation
- [x] GLM provider with API key support
- [x] Gemini CLI wrapper for local dev
- [x] Codex CLI wrapper for local dev
- [x] Unified LLM client replacing claude-client.ts
- [x] Backwards compatibility maintained
- [x] Configuration types updated

**Deliverables:**
- `workers/runtime/src/llm-providers/` (6 files)
- `workers/runtime/src/llm-client.ts`
- Updated imports in agent-do.ts and index.ts

---

## Subtask 1: Provider Abstraction Layer

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** High  
**Estimate:** 1h

**Description:**
Create abstract `LLMProvider` base class defining the interface all providers must implement.

**Acceptance Criteria:**
- [x] `base.ts` with LLMProvider abstract class
- [x] Standard interface: call(), validate(), getName(), getAvailableModels()
- [x] TypeScript interfaces for messages, responses, config
- [x] JSDoc documentation

**Files:**
- `workers/runtime/src/llm-providers/base.ts` (1,883 bytes)

---

## Subtask 2: Anthropic Provider (OAuth-Ready)

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** High  
**Estimate:** 1h

**Description:**
Implement Anthropic/Claude provider with existing API key support and OAuth preparation for future.

**Acceptance Criteria:**
- [x] Extend LLMProvider base class
- [x] Streaming support (no Cloudflare 524 timeouts)
- [x] OAuth flow prepared (placeholder)
- [x] API key fallback
- [x] Token counting from stream events
- [x] Unicode sanitization

**Files:**
- `workers/runtime/src/llm-providers/anthropic.ts` (5,089 bytes)

**Notes:**
Anthropic OAuth API not yet public - placeholder implementation ready for when available.

---

## Subtask 3: Z.ai GLM Provider

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** High  
**Estimate:** 45min

**Description:**
Implement GLM provider using Z.ai API (OpenAI-compatible format).

**Acceptance Criteria:**
- [x] API key authentication
- [x] OpenAI-compatible message format
- [x] Support glm-5, glm-4.7, glm-4.6v models
- [x] Custom base URL support
- [x] Token counting from API response
- [x] Error handling

**Files:**
- `workers/runtime/src/llm-providers/glm.ts` (2,977 bytes)

**Cost:** $10/month (cheapest option for production)

---

## Subtask 4: Gemini CLI Provider

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** Medium  
**Estimate:** 45min

**Description:**
Implement Gemini provider using google-gemini-cli (subscription-based, local dev only).

**Acceptance Criteria:**
- [x] CLI wrapper using child_process
- [x] Conversation format conversion
- [x] JSON output parsing
- [x] Timeout handling
- [x] Error handling
- [x] Version validation

**Files:**
- `workers/runtime/src/llm-providers/gemini.ts` (3,084 bytes)

**Environment:** Local development only (CLI not available in Workers)

---

## Subtask 5: OpenAI Codex CLI Provider

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** Medium  
**Estimate:** 45min

**Description:**
Implement Codex provider using openai-codex CLI (subscription-based, local dev only).

**Acceptance Criteria:**
- [x] CLI wrapper with temp file for messages
- [x] JSON message format
- [x] Cleanup temp files
- [x] Token counting from usage stats
- [x] Error handling
- [x] Version validation

**Files:**
- `workers/runtime/src/llm-providers/openai-codex.ts` (3,253 bytes)

**Environment:** Local development only (CLI not available in Workers)

---

## Subtask 6: Unified LLM Client

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** High  
**Estimate:** 30min

**Description:**
Create unified LLM client that routes to appropriate provider based on configuration.

**Acceptance Criteria:**
- [x] Environment variable support (LLM_PROVIDER_TYPE, LLM_PROVIDER_CONFIG)
- [x] Provider factory integration
- [x] Backwards compatible callClaude() export
- [x] Default to Anthropic if not configured
- [x] Config parsing with error handling

**Files:**
- `workers/runtime/src/llm-client.ts` (1,851 bytes)

---

## Subtask 7: Configuration Type Updates

**Status:** ✅ Done  
**Parent:** Main Task  
**Priority:** High  
**Estimate:** 15min

**Description:**
Update OpenChiefConfig type to support provider selection.

**Acceptance Criteria:**
- [x] Add runtime.llmProvider optional field
- [x] Support type, apiKey, oauth, cliPath, baseUrl
- [x] Backwards compatible (all fields optional)
- [x] JSDoc documentation

**Files:**
- `packages/shared/src/types/config.ts` (modified)

---

## Task: Documentation & Setup Tooling

**Status:** ✅ Done  
**Priority:** High  
**Assignee:** Operator  
**Estimate:** 2h → Actual: 1.5h

**Description:**
Create comprehensive documentation and setup tooling for multi-provider configuration.

**Acceptance Criteria:**
- [x] Complete setup guide (MULTI_PROVIDER_SETUP.md)
- [x] Interactive setup script (setup-providers.sh)
- [x] Technical summary (MULTI_PROVIDER_UPDATE.md)
- [x] Quick start guide (SETUP_COMPLETE.md)
- [x] Provider comparison table
- [x] Cost analysis
- [x] Troubleshooting guide

**Deliverables:**
- `docs/MULTI_PROVIDER_SETUP.md` (8,267 bytes)
- `scripts/setup-providers.sh` (4,661 bytes, executable)
- `MULTI_PROVIDER_UPDATE.md` (8,257 bytes)
- `SETUP_COMPLETE.md` (6,175 bytes)

---

## Task: Testing & Validation

**Status:** 🔄 Ready to Start  
**Priority:** High  
**Assignee:** TBD (Brandon or test agent)  
**Estimate:** 2h

**Description:**
Test all 4 providers in local dev and production environments.

**Acceptance Criteria:**
- [ ] Test Anthropic with existing API key (backwards compat)
- [ ] Test GLM with new API key (production mode)
- [ ] Test Gemini CLI in local dev
- [ ] Test Codex CLI in local dev
- [ ] Verify provider switching works
- [ ] Verify token counting accuracy
- [ ] Test error handling (invalid keys, network failures)
- [ ] Test setup script with all 4 options

**Subtasks:**
1. Local dev testing (all 4 providers)
2. Production deployment testing (Anthropic + GLM only)
3. Error scenario testing
4. Performance benchmarking

**Environment:**
- Local: `/Users/brandon/Documents/BGR/openchief`
- Production: TBD (Cloudflare Workers)

---

## Task: Cloudflare Workers Deployment

**Status:** 📋 Planned  
**Priority:** Medium  
**Assignee:** TBD (deployment agent)  
**Estimate:** 1h

**Description:**
Deploy multi-provider OpenChief to Cloudflare Workers with GLM or Anthropic.

**Acceptance Criteria:**
- [ ] Choose provider (recommend GLM for cost)
- [ ] Set Cloudflare secrets (LLM_PROVIDER_TYPE, LLM_PROVIDER_CONFIG)
- [ ] Run `pnpm run deploy`
- [ ] Verify deployment success
- [ ] Test report generation
- [ ] Monitor costs

**Prerequisites:**
- Testing task complete
- Provider API key obtained
- Cloudflare account configured

**Subtasks:**
1. Provider selection and API key acquisition
2. Secret configuration (wrangler secrets)
3. Deployment execution
4. Smoke testing
5. Cost monitoring setup

---

## Task: Future Enhancements

**Status:** 💡 Backlog  
**Priority:** Low  
**Assignee:** TBD  
**Estimate:** TBD

**Description:**
Future improvements to the multi-provider system.

**Ideas:**
- [ ] Anthropic OAuth implementation (when API available)
- [ ] Custom provider plugin system
- [ ] Provider health monitoring dashboard
- [ ] Automatic failover between providers
- [ ] Per-agent provider selection
- [ ] Local LLM support (Ollama, LM Studio)
- [ ] Azure OpenAI provider
- [ ] Mistral API provider
- [ ] Groq API provider
- [ ] Cost tracking and reporting
- [ ] Performance benchmarking dashboard

**Subtasks:**
- Create separate tasks for each enhancement as prioritized

---

## Task Dependencies

```
Epic: Multi-Provider LLM Integration
  ├─ Main Task: Architecture (✅ Done)
  │   ├─ Subtask 1: Base class (✅ Done)
  │   ├─ Subtask 2: Anthropic (✅ Done)
  │   ├─ Subtask 3: GLM (✅ Done)
  │   ├─ Subtask 4: Gemini CLI (✅ Done)
  │   ├─ Subtask 5: Codex CLI (✅ Done)
  │   ├─ Subtask 6: LLM Client (✅ Done)
  │   └─ Subtask 7: Config Types (✅ Done)
  ├─ Task: Documentation (✅ Done)
  ├─ Task: Testing (🔄 Ready) ← NEXT
  ├─ Task: Deployment (📋 Planned)
  └─ Task: Future Enhancements (💡 Backlog)
```

---

## Import to Linear

### Option 1: Manual Import

Copy this structure into Linear:
1. Create Epic: "Multi-Provider LLM Integration"
2. Create Main Task under Epic
3. Create 7 subtasks under Main Task
4. Create 4 sibling tasks (Documentation, Testing, Deployment, Future)
5. Set status for completed tasks to "Done"
6. Assign "Testing" task to appropriate agent

### Option 2: Automated Import (Requires Linear CLI Auth)

```bash
# Authenticate Linear CLI
linear login

# Run import script (to be created)
node scripts/import-to-linear.js LINEAR_TASKS.md
```

### Option 3: Use Linear API

```bash
# Set Linear API key
export LINEAR_API_KEY="your-key"

# Import via API (script to be created)
node scripts/linear-import-api.js
```

---

## Metrics

**Implementation:**
- Files created: 11
- Files modified: 1
- Lines of code: ~1,500
- Documentation: ~8,200 words
- Time: ~3 hours
- Commits: 3

**Status:**
- ✅ Core implementation: 100%
- ✅ Documentation: 100%
- 🔄 Testing: 0%
- 📋 Deployment: 0%

**Cost Savings:**
- GLM vs Anthropic: $10/mo vs $20/mo (50% reduction)
- GLM vs others: $10/mo vs $20/mo (50% reduction)

---

**Next Action:** Authenticate Linear and import tasks, or manually create in Linear UI.
