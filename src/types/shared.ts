/**
 * Shared types and interfaces for Claude Proxy v3
 */

export interface Env {
    /**
     * Pre-configured route for a "haiku" model for easier access.
     */
    HAIKU_MODEL_NAME: string;
    HAIKU_BASE_URL: string;
    HAIKU_API_KEY: string;

    /**
     * Enable local token counting (no API call).
     * Set to "true" or "1" to enable.
     */
    LOCAL_TOKEN_COUNTING?: string;

    /**
     * Token estimation factor for local counting.
     * Default: 4 (characters per token).
     */
    LOCAL_TOKEN_COUNTING_FACTOR?: string;
}

/**
 * Error response type for Claude API
 */
export interface ClaudeErrorResponse {
    type: "error" | "invalid_request_error" | "authentication_error" | "permission_error" | 
          "rate_limit_error" | "processing_error" | "over_limit_error";
    error: {
        type: string;
        message: string;
    };
}

/**
 * Target configuration extracted from dynamic path
 */
export interface TargetConfig {
    targetUrl: string;
    targetPathPrefix: string;
}

/**
 * HTTP response with Claude headers
 */
export interface ClaudeResponse {
    status: number;
    headers: Record<string, string>;
    body: any;
}

/**
 * Router context passed through middleware
 */
export interface RouterContext {
    request: Request;
    config: TargetConfig;
    clientParams: any;
    organizationId?: string;
    requestId?: string;
}
