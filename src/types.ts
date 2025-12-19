/**
 * Label to Slack channel mapping configuration
 */
export interface LabelChannelMap {
  /** Default channel ID when no rules match */
  default_channel_id?: string;
  /** Rules for label-based channel routing */
  rules?: LabelRule[];
}

/**
 * A rule that maps labels to a Slack channel
 */
export interface LabelRule {
  /** Labels to match (any match triggers the rule) */
  labels_any: string[];
  /** Target Slack channel ID */
  channel_id: string;
}

/**
 * Mapping from GitHub username to Slack user ID
 */
export interface SlackUserMap {
  [githubLogin: string]: string;
}

/**
 * GitHub Pull Request from the API
 */
export interface PR {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  user?: {
    login: string;
  };
  labels?: Array<{
    name?: string;
  }>;
  requested_reviewers?: Array<{
    login: string;
  }>;
}

/**
 * Simplified PR data for internal processing
 */
export interface PRSummary {
  number: number;
  title: string;
  url: string;
  author: string;
  labels: string[];
}

/**
 * Configuration for the action
 */
export interface ActionConfig {
  labelChannelMap: LabelChannelMap;
  slackUserMap: SlackUserMap;
  slackBotToken: string;
  githubToken: string;
  repository: string;
  dryRun: boolean;
}
