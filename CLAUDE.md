# Zed Development Rules

## Planning Phase

### 1. Requirements Analysis
- Break down the task into clear, testable requirements
- Identify all edge cases and boundary conditions upfront
- Document assumptions explicitly before starting implementation
- Consider error scenarios and failure modes
- Don't jump straight to solution, be clear about the requirements first. Such as:
  - What use cases are included?
  - What use cases are not included (if any) and why?
  - What are the limitations that we should adhere to?
  - How do we do error handling?
- Be thorough in your analysis and planning, don't make assumptions
- Be careful so that you're not missing any edge cases or boundary conditions
- Be careful so that you're not providing misleading information, double check your assumptions
- Consider important logs, metrics, and alerts
- Consider the impact on the user experience and the system's performance

### 2. Test Case Design
- List all positive test cases (happy paths)
- List all negative test cases (error conditions)
- Include boundary value tests (min, max, edge values)
- Consider integration points and external dependencies
- Think about performance implications and add performance tests if needed

### 3. Architecture Planning
- Identify which modules/components will be affected
- Plan the interface/API design before implementation
- Consider backward compatibility if modifying existing code
- Evaluate if the solution follows SOLID principles

### 4. Risk Identification
- **Technical Risks**: Breaking changes, performance degradation, security vulnerabilities
- **Data Risks**: Data loss, corruption, migration issues
- **Integration Risks**: Third-party API changes, dependency conflicts
- **User Impact**: Downtime, feature disruption, UX degradation
- **Mitigation Strategy**: Document how each risk will be prevented or handled

## Execution Phase

### 1. Test-Driven Development (TDD) - MANDATORY
**Always develop using TDD. No exceptions.**

- **Red Phase**: Write failing tests first
  - Start with the simplest test case
  - Ensure test actually fails for the right reason
  - Write one test at a time

- **Green Phase**: Write minimal code to pass
  - Implement just enough code to make the test pass
  - Don't optimize or refactor yet
  - Focus on correctness over elegance

- **Refactor Phase**: Improve code quality
  - Remove duplication
  - Improve naming and readability
  - Extract methods/functions where appropriate
  - Ensure all tests still pass after refactoring

- **Committing changes**: Pushing changes
  - Never commit directly to main branch
  - Do small atomic commits and make sure each commit is self-contained and is working

### 2. Code Implementation Standards
- Follow existing code conventions in the codebase
- Use meaningful variable and function names
- Keep functions small and focused (single responsibility)
- Handle errors gracefully with proper error messages
- Add type annotations where applicable
- Avoid magic numbers - use named constants
- Never commit to main
- Never commit to merged branch or merged PR

### 3. Testing Coverage
- Aim for high code coverage but focus on meaningful tests
- Test public APIs thoroughly
- Mock external dependencies appropriately
- Include integration tests for critical paths
- Add regression tests for bug fixes

## Review Phase

### 1. Automated Checks
- **Linting**: Run all linting tools and fix all warnings
  ```bash
  npm run lint        # or equivalent for your project
  pnpm run lint
  ```

- **Type Checking**: Ensure no type errors
  ```bash
  npm run typecheck   # or equivalent
  pnpm run typecheck
  ```

- **Testing**: All tests must pass
  ```bash
  npm test           # Run all tests
  npm run test:unit  # Run unit tests
  npm run test:e2e   # Run end-to-end tests
  ```

- **Build**: Ensure project builds successfully
  ```bash
  npm run build      # or equivalent
  pnpm run build
  ```

### 2. Manual Review Checklist
- [ ] All new code has corresponding tests
- [ ] Tests cover both success and failure scenarios
- [ ] No console.logs or debug code left in production code
- [ ] Documentation updated if API changed
- [ ] No hardcoded values or credentials
- [ ] Performance impact considered for large datasets
- [ ] Error messages are user-friendly and actionable

### 3. Code Quality Verification
- Check for code duplication
- Verify proper error handling throughout
- Ensure consistent coding style
- Validate that complexity is justified
- Confirm no security vulnerabilities introduced
- Review for potential race conditions or concurrency issues

## Pre-Commit Checklist

Before committing any changes:

1. ✅ All tests pass locally
2. ✅ Linting shows no errors or warnings
3. ✅ Type checking succeeds
4. ✅ Build completes successfully
5. ✅ Code has been self-reviewed
6. ✅ Commits have meaningful messages
7. ✅ No unintended files in the commit

## Pull Request Guidelines

### PR Creation and Review Process

**After Creating a PR:**
1. **Self-Review** - Review your own PR critically before requesting reviews from others
   - Check for code quality issues you might have missed
   - Verify all tests are passing
   - Look for potential improvements or refactoring opportunities
   - Document any known limitations or future improvements needed

2. **Address AI Code Assistant Feedback** - If using AI code review tools (e.g., Gemini Code Assist)
   - Carefully review all feedback from AI assistants
   - Prioritize CRITICAL and HIGH severity issues
   - Address all valid concerns before marking PR as ready for human review
   - Document why feedback was not addressed if intentionally skipped

3. **Iterate** - After addressing feedback
   - Re-review your changes to ensure fixes are correct
   - Run all tests and checks again
   - Update PR description if scope changed significantly
   - Check AI assistant feedback again to confirm all issues resolved

### PR Title
- One-liner that describes the change
- Format: `type: concise description` (e.g., `fix: prevent duplicate API calls`)

### PR Description Structure

**What Changed** (one-liner)
- Fixed duplicate enqueue calls in dashboard

**Why** (one-liner)
- Multiple renders caused race conditions

**Before**
- Dashboard made 3-5 duplicate API calls
- User experienced slow loading

**After**
- Single API call per dashboard load
- 60% faster page load

**Risks & Mitigation**
| Risk | Impact | Mitigation |
|------|--------|------------|
| Race condition in request handler | High | Added RequestDeduplicator with promise caching |
| Memory leak from cached promises | Low | Auto-cleanup after promise resolution |
| Breaking existing integrations | Medium | Backward compatible, feature flagged |

**Testing**
- ✅ Unit tests added for deduplicator
- ✅ Integration tests pass
- ✅ Manual testing on staging

**Rollback Plan** (if high risk)
- Revert commit: `git revert <hash>`
- Feature flag: `ENABLE_DEDUPLICATION=false`

### PR Best Practices
- Keep descriptions actionable and concise
- Use one-liners wherever appropriate
- Always highlight risks, even if low
- Include metrics when possible (performance improvements, error reduction)
- Link to relevant issues/tickets
- Add screenshots for UI changes
- Tag relevant reviewers based on code ownership

## Continuous Improvement

- After each task, reflect on what went well and what could improve
- Update these rules based on lessons learned
- Share knowledge with team through documentation or discussions
- Consider adding new test scenarios discovered during development
- Keep dependencies up to date and secure

## Context7

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.
