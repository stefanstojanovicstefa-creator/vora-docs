# Boban Voice Quality Enhancement - Implementation Plans

## Overview

This directory contains detailed, step-by-step implementation plans for two major voice quality features:

1. **Krisp Voice Isolation** - Audio quality enhancement
2. **IVR Detection & Handling** - Smart call routing

Both plans follow **Test-Driven Development (TDD)** methodology with bite-sized tasks (2-5 minutes each).

---

## 📋 Available Plans

### 1. Krisp Voice Isolation Integration
**File:** `2026-02-02-krisp-voice-isolation.md`

**What it does:**
- Removes background noise (traffic, TV, dogs, office chatter)
- Eliminates background voices during customer calls
- Improves Speech-to-Text accuracy
- Reduces false interrupts

**Complexity:** Medium
**Estimated Time:** 14-19 hours
**Tasks:** 10 tasks, ~50 steps total

**Prerequisites:**
- Krisp API key (signup at https://sdk-docs.krisp.ai/)

**Recommended:** **Implement this FIRST** - easier and provides foundation for IVR detection

---

### 2. IVR Detection & Handling
**File:** `2026-02-02-ivr-detection-handling.md`

**What it does:**
- Detects answering machines vs live persons
- Identifies IVR menu systems
- Recognizes automated gatekeepers
- Handles each scenario appropriately (hang up, navigate, or proceed)

**Complexity:** High
**Estimated Time:** 26-34 hours
**Tasks:** 14 tasks, ~80 steps total

**Prerequisites:**
- Test phone numbers (for voicemail/IVR testing)
- Database access (for callback scheduling)
- Krisp integration complete (optional but recommended)

**Recommended:** **Implement this SECOND** - benefits from Krisp's cleaner audio

---

## 🚀 How to Execute Plans

Each plan includes a special header for Claude:

```markdown
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
```

### Option 1: Subagent-Driven Development (Current Session)

**Use this for:** Quick iteration, immediate feedback

**How:**
1. Use the `superpowers:subagent-driven-development` skill
2. Fresh subagent handles each task
3. Code review between tasks
4. Stay in current session

**Command:**
```bash
# In Claude Code
/skill superpowers:subagent-driven-development
```

### Option 2: Parallel Session (Separate Worktree)

**Use this for:** Batch execution, independent work

**How:**
1. Create git worktree for implementation
2. Open new Claude Code session in worktree
3. Use `superpowers:executing-plans` skill
4. Checkpoint reviews at logical boundaries

**Commands:**
```bash
# Create worktree
git worktree add ../bobi-krisp-integration feature/krisp-integration

# Open new session
cd ../bobi-krisp-integration
claude

# In new session, use executing-plans skill
/skill superpowers:executing-plans
```

---

## 📊 Implementation Priority

**Recommended Execution Order:**

### Phase 1: Krisp Voice Isolation ✅
**Why first:**
- ✅ Easier to implement (mostly SDK integration)
- ✅ Immediate benefit (better audio quality)
- ✅ Lower risk (fallback to raw audio)
- ✅ Provides foundation for IVR (cleaner audio = better detection)

**Time commitment:** ~2-3 days (14-19 hours)

### Phase 2: IVR Detection & Handling ✅
**Why second:**
- Benefits from Krisp's cleaner audio (better transcript quality)
- More complex (multiple detection algorithms)
- Requires more testing scenarios
- Can leverage Krisp's improved STT accuracy

**Time commitment:** ~4-5 days (26-34 hours)

---

## 🎯 Quick Start Guide

### For Krisp Integration:

```bash
# 1. Review plan
open docs/plans/2026-02-02-krisp-voice-isolation.md

# 2. Get API key
# Visit: https://sdk-docs.krisp.ai/

# 3. Execute plan (choose one method)
# Option A: Subagent-driven (current session)
/skill superpowers:subagent-driven-development

# Option B: Separate session
git worktree add ../bobi-krisp feature/krisp-integration
cd ../bobi-krisp
claude
# Then use: /skill superpowers:executing-plans
```

### For IVR Detection:

```bash
# 1. Review plan
open docs/plans/2026-02-02-ivr-detection-handling.md

# 2. Prepare test numbers
# - Get voicemail test number
# - Get IVR system test number

# 3. Execute plan (after Krisp is complete)
/skill superpowers:subagent-driven-development
```

---

## 📁 Plan Structure

Each plan follows this structure:

1. **Prerequisites** - What you need before starting
2. **Task N: Component Name**
   - Files to create/modify
   - Step 1: Write failing test
   - Step 2: Run test (verify failure)
   - Step 3: Write implementation
   - Step 4: Run test (verify pass)
   - Step 5: Commit
3. **Verification Plan** - How to test it works
4. **Rollback Plan** - How to undo if needed

---

## ✅ Task Granularity

Each step is **one action** (2-5 minutes):

- ❌ **Too large:** "Implement Krisp integration"
- ✅ **Perfect:** "Write test for Krisp initialization"

**Benefits:**
- Easy to resume if interrupted
- Clear progress tracking
- Frequent commits (easy rollback)
- Follows TDD discipline

---

## 🧪 Testing Strategy

Both plans include comprehensive testing:

### Unit Tests
- Test individual components in isolation
- Fast execution (<1 second per test)
- No external dependencies

### Integration Tests
- Test component interactions
- Slower execution (a few seconds)
- May require API keys or test data

### Manual Tests
- Real-world validation
- A/B comparisons
- Edge case verification

---

## 📈 Success Metrics

### Krisp Integration
- ≥20% reduction in STT errors
- ≥50% reduction in false interrupts
- Improved audio quality (subjective 4/5 rating)

### IVR Detection
- ≥80% detection accuracy
- <5% false positive rate (live person misclassified)
- ≥30 minutes saved per day (not talking to machines)

---

## 🔄 Rollback Strategy

Both plans include rollback instructions:

**Immediate disable:**
```bash
# Krisp
KRISP_ENABLED=false

# IVR Detection
IVR_DETECTION_ENABLED=false
```

**Code rollback:**
```bash
git revert HEAD~N  # Revert feature commits
```

---

## 📞 Support & Questions

If you encounter issues during implementation:

1. **Check plan thoroughly** - Most questions answered in detail
2. **Review verification sections** - See how to test each component
3. **Check rollback plan** - Know how to undo changes
4. **Reference original docs** - `Boban-Updates/KRISP_IMPLEMENTATION_PLAN.md` and `IVR_DETECTION_IMPLEMENTATION_PLAN.md`

---

## 🎬 Next Steps

### Choose Your Path:

**Path A: Implement Krisp First (Recommended)**
1. Review `2026-02-02-krisp-voice-isolation.md`
2. Obtain Krisp API key
3. Execute plan using preferred method
4. Validate with A/B testing
5. Monitor production for 2-3 days
6. Proceed to IVR detection

**Path B: Implement Both in Parallel**
1. Use git worktrees for isolation
2. One session for Krisp integration
3. Another session for IVR detection
4. Merge Krisp first, then IVR

**Path C: Skip to IVR Detection**
1. Only if Krisp is not priority
2. Be aware: Detection accuracy may be lower without Krisp
3. Can add Krisp later

---

## 📚 References

### Krisp Resources
- [Krisp Developer Docs](https://sdk-docs.krisp.ai/)
- [Krisp VIVA SDK](https://sdk-docs.krisp.ai/docs/noisecancellation)
- [LiveKit Audio Processing](https://docs.livekit.io/agents/audio/)

### IVR Resources
- [Twilio AMD Guide](https://www.twilio.com/docs/voice/answering-machine-detection)
- [Call Progress Analysis](https://en.wikipedia.org/wiki/Call_progress_analysis)
- [Telnyx AMD Best Practices](https://www.telnyx.com/resources/answering-machine-detection)

---

**Ready to enhance Boban's voice quality? Start with the Krisp plan!** 🚀
