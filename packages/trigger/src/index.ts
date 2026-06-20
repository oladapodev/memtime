export type { TriggerMode, TriggerConfig, CustomConfig, FileFilter, TriggerEvaluation, PullRequestEvent, IssueCommentEvent } from "./types";
export { evaluatePullRequestTrigger, matchesCommentTag } from "./evaluator";
