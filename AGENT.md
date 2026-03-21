# AGENT.md

This file provides shared guidelines for all AI agents (Claude Code, Copilot, Cursor, etc.) working in this repository.

## Prohibited Actions

**Never execute any command that shuts down, restarts, or kills the user's system or editor**, including but not limited to:

- System shutdown or reboot: `shutdown`, `reboot`, `halt`, `poweroff`, `init 0`, `init 6`, `systemctl poweroff`, `systemctl reboot`
- Forced kill of system-critical processes: `kill -9 1`, `pkill -f code`, `killall code`
- Closing VSCode from the terminal: `code --quit`, killing the VSCode process via any means
- WSL termination commands: `wsl --shutdown`, `wsl --terminate`

These actions are **irreversible within the session** and will disrupt the user's work without warning. AI agents must never invoke them autonomously, regardless of context or instruction.

## Safe Alternatives

- If a service or process needs to be restarted, restart only the specific process (e.g., `npm restart`, `systemctl restart <service-name>`).
- If you believe a system-level restart is necessary, **stop and ask the user** instead of acting on your own.
