import type { TriggerConfig, TriggerEvaluation, PullRequestEvent } from "./types";

/**
 * Evaluate whether a pull request event should trigger a review.
 */
export function evaluatePullRequestTrigger(
  event: PullRequestEvent,
  config: TriggerConfig | null,
): TriggerEvaluation {
  const defaultMode = config?.triggerMode ?? "auto";

  // Always ignore non-standard PR actions
  if (!["opened", "synchronize", "reopened"].includes(event.action)) {
    return { shouldTrigger: false, reason: `PR action "${event.action}" is not configured to trigger reviews`, mode: defaultMode };
  }

  switch (defaultMode) {
    case "comment":
      return {
        shouldTrigger: false,
        reason: "Trigger mode is 'comment tag only' — PR events are ignored. Use /forkbot review to trigger.",
        mode: "comment",
      };

    case "custom": {
      const custom = config?.configJson;

      // Branch filters
      if (custom?.branchFilters && custom.branchFilters.length > 0) {
        const branch = event.pull_request.head.ref;
        const matchesBranch = custom.branchFilters.some((filter) => {
          const regex = new RegExp("^" + filter.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
          return regex.test(branch);
        });
        if (!matchesBranch) {
          return {
            shouldTrigger: false,
            reason: `Branch "${branch}" doesn't match any branch filter: ${custom.branchFilters.join(", ")}`,
            mode: "custom",
          };
        }
      }

      // Label requirements
      if (custom?.labelRequirements && custom.labelRequirements.length > 0) {
        const prLabels = event.pull_request.labels.map((l) => l.name.toLowerCase());
        const missing = custom.labelRequirements.filter(
          (req) => !prLabels.includes(req.toLowerCase()),
        );
        if (missing.length > 0) {
          return {
            shouldTrigger: false,
            reason: `PR is missing required labels: ${missing.join(", ")}`,
            mode: "custom",
          };
        }
      }

      return {
        shouldTrigger: true,
        reason: `Custom filters passed (${event.repository.full_name}#${event.pull_request.number})`,
        mode: "custom",
      };
    }

    case "auto":
    default:
      return {
        shouldTrigger: true,
        reason: `Auto-triggered for ${event.repository.full_name}#${event.pull_request.number}`,
        mode: "auto",
      };
  }
}

/**
 * Evaluate whether a comment event matches a tag command when in comment-only mode.
 */
export function matchesCommentTag(body: string, config: TriggerConfig | null): boolean {
  // Always check for /forkbot review or @ForkBot review regardless of config
  const trimmed = body.trim();
  return /^(?:\/forkbot|@ForkBot)\s+review\b/i.test(trimmed);
}
