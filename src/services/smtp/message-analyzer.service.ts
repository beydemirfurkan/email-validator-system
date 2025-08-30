/**
 * SMTP Message Analysis and Classification System
 * Advanced pattern recognition and response classification
 */

interface PatternConfig {
  patterns: RegExp[];
  severity: 'low' | 'medium' | 'high';
  action: string;
}

interface DetectedIssue {
  category: string;
  pattern: string;
  severity: string;
  action: string;
}

interface MessageAnalysis {
  detected_issues: DetectedIssue[];
  severity: 'low' | 'medium' | 'high';
  recommended_action: string;
  confidence: number;
}

interface SmtpClassification {
  result: 'valid' | 'invalid' | 'unknown';
  reason_code: string;
  smtp_code: number;
  details: string;
  message_analysis?: MessageAnalysis;
  server_hint?: string;
}

// Advanced SMTP message analysis patterns
const MESSAGE_PATTERNS: Record<string, PatternConfig> = {
  blocked: {
    patterns: [/blocked?/i, /blacklist/i, /reputation/i, /spam/i, /abuse/i, /policy\s*violation/i],
    severity: 'high',
    action: 'ip_rotation',
  },
  rate_limited: {
    patterns: [/rate\s*limit/i, /too\s*many/i, /exceed/i, /throttle/i, /slow\s*down/i, /frequent/i],
    severity: 'medium',
    action: 'delay_and_retry',
  },
  greylisted: {
    patterns: [
      /grey?list/i,
      /gray?list/i,
      /try\s*again/i,
      /try\s*later/i,
      /temporary\s*defer/i,
      /please\s*retry/i,
    ],
    severity: 'low',
    action: 'exponential_backoff',
  },
  connection_issues: {
    patterns: [
      /connection\s*refused/i,
      /network\s*unreachable/i,
      /timeout/i,
      /connection\s*reset/i,
      /no\s*route/i,
    ],
    severity: 'medium',
    action: 'try_next_mx',
  },
  server_busy: {
    patterns: [/server\s*busy/i, /service\s*unavailable/i, /overload/i, /capacity/i, /resources/i],
    severity: 'low',
    action: 'retry_later',
  },
  authentication_issues: {
    patterns: [
      /authentication/i,
      /auth.*required/i,
      /permission\s*denied/i,
      /access\s*denied/i,
      /not\s*authorized/i,
    ],
    severity: 'medium',
    action: 'check_credentials',
  },
};

function analyzeServerMessage(message: string, code: number): MessageAnalysis | null {
  if (!message) {
    return null;
  }

  const analysis: MessageAnalysis = {
    detected_issues: [],
    severity: 'low',
    recommended_action: 'continue',
    confidence: 0,
  };

  let maxSeverity = 0;
  const severityLevels = { low: 1, medium: 2, high: 3 };

  // Analyze message against all patterns
  for (const [category, config] of Object.entries(MESSAGE_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(message)) {
        analysis.detected_issues.push({
          category,
          pattern: pattern.source,
          severity: config.severity,
          action: config.action,
        });

        const currentSeverity = severityLevels[config.severity];
        if (currentSeverity > maxSeverity) {
          maxSeverity = currentSeverity;
          analysis.severity = config.severity;
          analysis.recommended_action = config.action;
        }

        analysis.confidence = Math.min(100, analysis.confidence + 25);
        break; // Only count first match per category
      }
    }
  }

  // Add SMTP code specific insights
  if (code >= 500) {
    analysis.confidence = Math.min(100, analysis.confidence + 15);
  } else if (code >= 400) {
    analysis.confidence = Math.min(100, analysis.confidence + 10);
  }

  return analysis.detected_issues.length > 0 ? analysis : null;
}

export function classifySmtpResponse(code: number, message: string, reason: string): SmtpClassification {
  // Detailed SMTP response classification
  const classification: SmtpClassification = {
    result: 'unknown',
    reason_code: 'unknown',
    smtp_code: code,
    details: message,
  };

  // Analyze server message for additional insights
  const messageAnalysis = analyzeServerMessage(message, code);
  if (messageAnalysis) {
    classification.message_analysis = messageAnalysis;
    classification.server_hint = messageAnalysis.recommended_action;
  }

  if (reason === 'Accepted' && code >= 200 && code < 300) {
    classification.result = 'valid';
    classification.reason_code = 'accepted';
    return classification;
  }

  // Permanent failures (5xx)
  if (code >= 500 && code < 600) {
    classification.result = 'invalid';

    if (code === 550) {
      if (/user.*unknown|recipient.*unknown|no.*mailbox|does.*not.*exist/i.test(message)) {
        classification.reason_code = 'invalid_user';
      } else if (/relay.*denied|relaying.*denied/i.test(message)) {
        classification.reason_code = 'relay_denied';
      } else {
        classification.reason_code = 'user_reject';
      }
    } else if (code === 551) {
      classification.reason_code = 'user_not_local';
    } else if (code === 552) {
      classification.reason_code = 'mailbox_full';
    } else if (code === 553) {
      classification.reason_code = 'invalid_address_syntax';
    } else if (code === 554) {
      classification.reason_code = 'server_reject';
    } else if (code === 571) {
      classification.reason_code = 'server_reject';
    } else {
      classification.reason_code = 'permanent_failure';
    }
    return classification;
  }

  // Temporary failures (4xx)
  if (code >= 400 && code < 500) {
    classification.result = 'unknown';

    if (code === 421) {
      classification.reason_code = 'service_unavailable';
    } else if (code === 450) {
      classification.reason_code = 'mailbox_busy';
    } else if (code === 451) {
      if (/grey.*list|gray.*list|try.*later/i.test(message)) {
        classification.reason_code = 'greylisted';
      } else {
        classification.reason_code = 'temporary_failure';
      }
    } else if (code === 452) {
      classification.reason_code = 'mailbox_full';
    } else if (code === 454) {
      classification.reason_code = 'temporary_failure';
    } else {
      classification.reason_code = 'temporary_failure';
    }
    return classification;
  }

  // Success codes (2xx, 3xx)
  if (code >= 200 && code < 400) {
    classification.result = 'valid';
    classification.reason_code = 'accepted';
    return classification;
  }

  return classification;
}

export {
  MESSAGE_PATTERNS,
  analyzeServerMessage,
  type SmtpClassification,
  type MessageAnalysis
};