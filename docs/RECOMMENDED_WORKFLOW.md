# HamSCI Magnetometer Dashboard - Student Workflow Guide

This document provides a recommended workflow and GitHub project management tips for the undergraduate developer working on the HamSCI Magnetometer Web Dashboard project.

## Project Overview

**Repository:** https://github.com/HamSCI/gmag_webui
**Project Board:** https://github.com/orgs/HamSCI/projects/7
**Requirements Document:** [REQUIREMENTS.md](./REQUIREMENTS.md)

### Key Deliverables

| Milestone | Due Date | Description |
|-----------|----------|-------------|
| MVP Prototype | March 14, 2026 | Working demo for HamSCI Workshop |
| v1.0 Release | May 1, 2026 | Complete product ready for deployment |

---

## Recommended Workflow

### Phase 1: MVP Prototype (Weeks 1-7)

The MVP milestone contains 10 issues that represent the core functionality needed for the HamSCI Workshop demo. These are all **must-have** features.

#### Week 1: Project Setup
- Start with **Issue #11: Project Setup and Architecture Decision**
- Make key technology choices (framework, runtime, charting library)
- Set up development environment
- Document your decisions in the README

#### Weeks 2-3: Core Data Pipeline
- **Issue #2: WebSocket Data Streaming** - Connect to mag-usb data
- **Issue #3: XYZ to HEZ Coordinate Transformation** - Process the data correctly
- **Issue #10: Create Simple Backend Server** - Serve the dashboard and bridge data

#### Weeks 4-5: Visualization
- **Issue #4: Real-Time Time-Series Plots** - Display H, E, Z components
- **Issue #5: Zoom and Pan** - Interactive chart navigation
- **Issue #7: Connection Status Indicators** - Show connection state

#### Weeks 6-7: Polish and Integration
- **Issue #6: Basic Responsive Web Interface** - Clean, usable layout
- **Issue #8: Offline Support** - Vendor all JavaScript libraries
- **Issue #9: Performance** - Ensure no memory leaks with continuous data
- Integration testing and bug fixes

#### March 14-15: HamSCI Workshop Demo
- Present working prototype
- Gather feedback from users

### Phase 2: v1.0 Release (Weeks 8-14)

After the workshop, complete the remaining 18 issues for the full release.

#### Priority Order
1. **P0 (Must-have):** Issues #12, #13, #15, #25, #27
2. **P1 (Should-have):** Issues #14, #16-24, #26
3. **P2 (Nice-to-have):** Issues #28, #29 (only if time permits)

#### Suggested Order for Phase 2
1. Historical data features (#12, #13, #14, #15)
2. Documentation (#25)
3. Enhanced UI (#16, #17, #20)
4. Advanced data processing (#18, #22, #23, #24)
5. MQTT support (#19)
6. Multi-station support (#21)
7. Testing (#26, #27)
8. Optional features (#28, #29)

---

## Using the GitHub Project Board

### Accessing the Project

1. Go to https://github.com/orgs/HamSCI/projects/7
2. You'll see the Kanban board view by default

### Understanding the Board Columns (Status)

| Column | Meaning |
|--------|---------|
| **Backlog** | Not yet ready to work on |
| **Ready** | Ready to start, all prerequisites met |
| **In progress** | Currently being worked on |
| **In review** | Code complete, awaiting review |
| **Done** | Completed and merged |

### Working with Issues

#### Starting Work on an Issue
1. Find the issue in the "Ready" or "Backlog" column
2. Drag it to "In progress" (or click and change the Status field)
3. Assign yourself to the issue
4. Create a branch for your work:
   ```bash
   git checkout -b feature/issue-XX-short-description
   ```

#### While Working
- Check off tasks within the issue as you complete them
- Commit regularly with meaningful messages
- Reference the issue in commits: `git commit -m "Add WebSocket client (#2)"`

#### Completing an Issue
1. Push your branch and create a Pull Request
2. Reference the issue: "Closes #XX" in the PR description
3. Move the issue to "In review"
4. After PR is merged, the issue will automatically close

### Using Project Fields

The project has several useful fields you can set on each issue:

| Field | How to Use |
|-------|------------|
| **Priority** | P0 = Must do, P1 = Should do, P2 = Nice to have |
| **Size** | Estimate effort: XS (< 1 hour), S (few hours), M (1-2 days), L (several days), XL (1+ week) |
| **Start date** | When you plan to begin |
| **Target date** | When you aim to complete (pre-set to milestone dates) |

### Helpful Views

Click **"+ New view"** to create different perspectives:

#### Table View
- See all issues with their fields in a spreadsheet format
- Great for updating multiple fields at once
- Sort by priority, size, or target date

#### Board View (Default)
- Kanban-style drag and drop
- Visual progress tracking
- Group by Status (default) or by Priority

#### Roadmap View
- Timeline visualization
- Shows start and target dates
- Helps visualize the semester schedule
- Great for planning and identifying conflicts

### Filtering Issues

Use the filter bar to focus on specific issues:

```
# Show only MVP milestone
milestone:"MVP Prototype - HamSCI Workshop"

# Show only visualization work
label:visualization

# Show high priority items
priority:P0

# Combine filters
milestone:"v1.0 Release" label:ui

# Show your assigned issues
assignee:@me
```

---

## Git Workflow

### Branch Naming Convention
```
feature/issue-XX-short-description
bugfix/issue-XX-short-description
docs/issue-XX-short-description
```

### Commit Message Format
```
Short summary (50 chars or less)

Longer description if needed. Explain what and why,
not how (the code shows how).

Refs #XX
```

### Pull Request Checklist
- [ ] Code follows project style guidelines
- [ ] Self-reviewed the changes
- [ ] Added/updated comments where needed
- [ ] Tested the changes locally
- [ ] Updated documentation if applicable
- [ ] PR description explains what and why

---

## Communication Tips

### Weekly Updates
Consider posting a brief weekly update as a comment on the relevant milestone or in a discussion thread:
- What you completed this week
- What you're working on next
- Any blockers or questions

### Asking Questions
- Check the requirements document first
- Search existing issues for related discussions
- Open a new issue with the `question` label if needed
- Don't hesitate to ask - it's better to clarify than to build the wrong thing

### Requesting Help
- Use the `help wanted` label on issues where you're stuck
- Be specific about what you've tried and where you're blocked

---

## Development Tips

### Testing Your Work
- Test with real mag-usb data when possible
- Use sample JSONL files for offline development
- Test in multiple browsers (Chrome, Firefox, Safari)
- Test with the network disconnected (offline mode)

### Performance Considerations
- The sensor sends data at 1 Hz continuously
- Buffer management is critical - don't store unlimited data
- Profile memory usage during extended runs
- Test with at least 1 hour of continuous data

### Code Quality
- Write comments explaining "why," not "what"
- Keep functions small and focused
- Use meaningful variable names
- Follow existing code style in the project

---

## Quick Reference

### Important Links
- **Repository:** https://github.com/HamSCI/gmag_webui
- **Project Board:** https://github.com/orgs/HamSCI/projects/7
- **Requirements:** [REQUIREMENTS.md](./REQUIREMENTS.md)
- **mag-usb (data source):** https://github.com/wittend/mag-usb
- **mag-dash (reference):** https://github.com/wittend/mag-dash

### Key Dates
- **January 22, 2026:** Project kickoff
- **March 14-15, 2026:** HamSCI Workshop (MVP demo)
- **May 1, 2026:** v1.0 Release deadline

### Getting Help
- Check existing issues and documentation
- Post questions with the `question` label
- Contact your project supervisor

---

*Good luck with the project! Remember: steady progress beats last-minute rushes. Work on issues consistently, commit often, and don't hesitate to ask questions.*
