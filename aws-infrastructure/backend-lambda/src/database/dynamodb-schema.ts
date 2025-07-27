/**
 * Ultra-Comprehensive DynamoDB Schema Design for Voice Matrix
 * Optimized for performance, scalability, and all access patterns
 */

// ============================================================================
// ACCESS PATTERN ANALYSIS & TABLE DESIGN STRATEGY
// ============================================================================

/**
 * PRIMARY ACCESS PATTERNS ANALYSIS:
 * 
 * 1. Template Management:
 *    - Get all active templates (template selection UI)
 *    - Get template by ID (assistant creation)
 *    - Filter templates by industry/category/complexity
 *    - Search templates by keywords/tags
 *    - Get template usage statistics
 *    - Template versioning and history
 * 
 * 2. Assistant Management:
 *    - Get user's assistants (dashboard)
 *    - Get assistant by ID (editing/deployment)
 *    - List assistants by status (active/paused/error)
 *    - Get assistants by template type
 *    - Assistant performance tracking
 * 
 * 3. Call Analytics:
 *    - Get call logs by assistant ID
 *    - Get calls by date range
 *    - Performance metrics aggregation
 *    - Real-time analytics updates
 *    - Historical trend analysis
 * 
 * 4. Performance & Analytics:
 *    - Template popularity tracking
 *    - User engagement metrics
 *    - System performance monitoring
 *    - Business intelligence queries
 */

// ============================================================================
// TABLE 1: PROMPT_TEMPLATES
// ============================================================================

export interface PromptTemplatesTable {
  // Primary Key
  templateId: string; // PK: template-{uuid} or predefined-{name}
  
  // Template Metadata
  name: string;
  version: string;
  status: 'active' | 'deprecated' | 'beta' | 'draft';
  templateType: 'predefined' | 'custom' | 'cloned';
  
  // Business Context
  category: string; // e.g., "sales", "support", "booking"
  industry: string[]; // ["healthcare", "saas", "general"]
  complexity: 'basic' | 'intermediate' | 'advanced';
  
  // Template Content (Large JSON)
  templateData: string; // JSON stringified EnhancedPromptTemplate
  
  // Performance Metrics
  usageCount: number;
  averageRating: number;
  lastUsed: string; // ISO timestamp
  
  // Management Fields
  createdAt: string;
  updatedAt: string;
  createdBy: string; // user-id or "system"
  parentTemplateId?: string; // For cloned/inherited templates
  
  // Search & Discovery
  tags: string[]; // ["lead-generation", "BANT", "qualification"]
  keywords: string; // Searchable text for full-text search
  
  // Versioning
  isLatestVersion: boolean;
  versionHistory?: string; // JSON array of version changes
  
  // Access Control
  visibility: 'public' | 'private' | 'organization';
  permissions?: string; // JSON permissions object
}

/**
 * Global Secondary Indexes for PromptTemplates:
 * 
 * GSI1: Category-CreatedAt-Index
 * - PK: category
 * - SK: createdAt
 * - Purpose: Get templates by category, sorted by creation date
 * 
 * GSI2: Industry-UsageCount-Index  
 * - PK: industry (using sparse index)
 * - SK: usageCount
 * - Purpose: Get popular templates by industry
 * 
 * GSI3: Status-UpdatedAt-Index
 * - PK: status
 * - SK: updatedAt  
 * - Purpose: Get templates by status (active/beta/deprecated)
 * 
 * GSI4: CreatedBy-CreatedAt-Index
 * - PK: createdBy
 * - SK: createdAt
 * - Purpose: Get user's custom templates
 */

// ============================================================================
// TABLE 2: USER_ASSISTANTS
// ============================================================================

export interface UserAssistantsTable {
  // Primary Key
  assistantId: string; // PK: assistant-{uuid}
  
  // User Association
  userId: string; // GSI PK for user queries
  
  // Assistant Configuration
  name: string;
  description?: string;
  templateId: string; // Reference to PromptTemplates
  
  // Dynamic Configuration
  dynamicSegments: string; // JSON of user customizations
  assembledPrompt: string; // Final prompt after assembly
  
  // VAPI Integration
  vapiAssistantId?: string; // VAPI's assistant ID
  vapiConfiguration: string; // JSON of VAPI settings
  phoneNumber?: string;
  
  // Voice Settings
  voiceSettings: string; // JSON voice configuration
  
  // Status & Lifecycle
  status: 'draft' | 'active' | 'paused' | 'error' | 'deploying';
  deploymentStatus?: string; // JSON deployment details
  lastDeployedAt?: string;
  
  // Performance Tracking
  totalCalls: number;
  successfulCalls: number;
  averageCallDuration: number;
  averageRating: number;
  lastCallAt?: string;
  
  // Analytics Summary (Denormalized for performance)
  performanceMetrics: string; // JSON summary metrics
  kpiScores: string; // JSON KPI achievement scores
  
  // Management
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  
  // Configuration Versioning
  configVersion: number;
  configHistory?: string; // JSON array of config changes
  
  // Business Context
  businessObjectives: string; // JSON array of objectives
  industryTags: string[]; // For analytics and grouping
  
  // Webhook Configuration
  webhookUrl?: string;
  webhookEvents: string[]; // ["call_end", "escalation_triggered"]
  
  // Compliance & Security
  complianceSettings?: string; // JSON compliance configuration
  dataRetentionDays: number;
}

/**
 * Global Secondary Indexes for UserAssistants:
 * 
 * GSI1: UserId-CreatedAt-Index
 * - PK: userId
 * - SK: createdAt
 * - Purpose: Get user's assistants sorted by creation date
 * 
 * GSI2: Status-LastCallAt-Index
 * - PK: status
 * - SK: lastCallAt
 * - Purpose: Get assistants by status, sorted by activity
 * 
 * GSI3: TemplateId-CreatedAt-Index
 * - PK: templateId
 * - SK: createdAt
 * - Purpose: Get all assistants using a specific template
 * 
 * GSI4: UserId-Status-Index
 * - PK: userId
 * - SK: status
 * - Purpose: Get user's assistants filtered by status
 * 
 * Local Secondary Index:
 * LSI1: AssistantId-LastCallAt-Index
 * - PK: assistantId (same as main table)
 * - SK: lastCallAt
 * - Purpose: Sort user's assistants by last activity
 */

// ============================================================================
// TABLE 3: CALL_LOGS
// ============================================================================

export interface CallLogsTable {
  // Primary Key
  callId: string; // PK: call-{uuid}
  
  // Assistant Association
  assistantId: string; // GSI PK for assistant queries
  userId: string; // For user-level analytics
  templateId: string; // For template performance tracking
  
  // Call Metadata
  startTime: string; // ISO timestamp
  endTime?: string;
  duration: number; // seconds
  
  // Call Details
  phoneNumber?: string;
  direction: 'inbound' | 'outbound';
  callStatus: 'completed' | 'failed' | 'abandoned' | 'transferred';
  
  // Conversation Data
  transcript: string; // Full conversation transcript
  summary: string; // AI-generated summary
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1 to 1
  
  // Business Outcomes
  objectivesAchieved: string[]; // ["lead_qualified", "appointment_booked"]
  leadScore?: number; // For lead qualification calls
  npsScore?: number; // For feedback calls
  issuesIdentified: string[]; // For support calls
  
  // Performance Metrics
  responseTime: number; // Average response time in ms
  interruptions: number; // Number of customer interruptions
  escalationTriggered: boolean;
  escalationReason?: string;
  
  // VAPI Data
  vapiCallId?: string;
  vapiMetadata?: string; // JSON VAPI-specific data
  
  // Analytics Data
  conversationFlow: string; // JSON flow analysis
  keywordsMentioned: string[]; // Important keywords detected
  topicsDiscussed: string[]; // Conversation topics
  
  // Quality Scores
  callQualityScore: number; // 1-5 overall quality
  customerSatisfaction?: number; // 1-5 if collected
  agentPerformance: number; // AI agent performance score
  
  // Follow-up Actions
  nextSteps: string[]; // Required follow-up actions
  followUpScheduled?: string; // ISO timestamp
  followUpCompleted?: boolean;
  
  // Data Processing
  processedAt: string; // When analytics were processed
  processingVersion: string; // Version of processing pipeline
  
  // Compliance
  recordingUrl?: string; // If call was recorded
  dataRetentionDate: string; // When to delete this record
  consentGiven: boolean; // Recording/processing consent
  
  // Partitioning (for time-series optimization)
  yearMonth: string; // YYYY-MM for time-based partitioning
  dayOfYear: number; // 1-366 for daily analytics
}

/**
 * Global Secondary Indexes for CallLogs:
 * 
 * GSI1: AssistantId-StartTime-Index
 * - PK: assistantId
 * - SK: startTime
 * - Purpose: Get calls for specific assistant, sorted by time
 * 
 * GSI2: UserId-StartTime-Index
 * - PK: userId
 * - SK: startTime
 * - Purpose: Get all user's calls across assistants
 * 
 * GSI3: YearMonth-StartTime-Index
 * - PK: yearMonth
 * - SK: startTime
 * - Purpose: Time-based analytics and archiving
 * 
 * GSI4: TemplateId-StartTime-Index
 * - PK: templateId
 * - SK: startTime
 * - Purpose: Template performance analytics
 * 
 * GSI5: CallStatus-StartTime-Index
 * - PK: callStatus
 * - SK: startTime
 * - Purpose: Monitor failed/abandoned calls
 */

// ============================================================================
// TABLE 4: TEMPLATE_ANALYTICS
// ============================================================================

export interface TemplateAnalyticsTable {
  // Primary Key
  analyticsId: string; // PK: {templateId}#{period} e.g., "template-123#2024-01"
  
  // Template Reference
  templateId: string; // GSI PK
  
  // Time Period
  period: string; // "2024-01" for monthly, "2024-01-15" for daily
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  
  // Usage Metrics
  totalUsages: number; // How many assistants created
  activeAssistants: number; // Currently active assistants
  totalCalls: number; // Total calls across all assistants
  successfulCalls: number; // Successful call completions
  
  // Performance Metrics
  averageCallDuration: number;
  averageSuccessRate: number;
  averageCustomerSatisfaction: number;
  averageCallQuality: number;
  
  // Business Outcomes
  objectivesAchieved: Record<string, number>; // {"lead_qualified": 145, "appointments_booked": 67}
  conversionRates: Record<string, number>; // Success rates by objective
  
  // User Engagement
  uniqueUsers: number; // Users who used this template
  newUsers: number; // First-time users this period
  returningUsers: number; // Repeat users
  
  // Rating & Feedback
  totalRatings: number;
  averageRating: number;
  ratingDistribution: number[]; // [1,2,3,4,5] star counts
  
  // Industry Performance
  industryBreakdown: Record<string, number>; // Usage by industry
  complexityAdoption: Record<string, number>; // Usage by complexity level
  
  // Trends & Changes
  growthRate: number; // Period-over-period growth %
  trendDirection: 'up' | 'down' | 'stable';
  
  // Computed Fields
  popularityScore: number; // Weighted popularity metric
  recommendationScore: number; // How likely to recommend
  
  // Last Updated
  computedAt: string;
  dataVersion: string;
}

/**
 * Global Secondary Indexes for TemplateAnalytics:
 * 
 * GSI1: TemplateId-Period-Index
 * - PK: templateId
 * - SK: period
 * - Purpose: Get analytics for specific template over time
 * 
 * GSI2: PeriodType-PopularityScore-Index
 * - PK: periodType
 * - SK: popularityScore
 * - Purpose: Get most popular templates for a time period
 * 
 * GSI3: Period-GrowthRate-Index
 * - PK: period
 * - SK: growthRate
 * - Purpose: Identify fastest-growing templates
 */

// ============================================================================
// TABLE 5: USER_SESSIONS
// ============================================================================

export interface UserSessionsTable {
  // Primary Key
  sessionId: string; // PK: session-{uuid}
  
  // User Information
  userId: string; // GSI PK
  userEmail: string;
  
  // Session Data
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  
  // Activity Tracking
  actionsPerformed: string[]; // ["template_viewed", "assistant_created"]
  templatesViewed: string[]; // Template IDs viewed
  assistantsAccessed: string[]; // Assistant IDs accessed
  
  // Analytics Events
  events: string; // JSON array of detailed events
  
  // Session Context
  userAgent?: string;
  ipAddress?: string;
  location?: string; // Approximate location
  
  // Performance Metrics
  responseTime: number; // Average API response time
  errorCount: number;
  
  // Expiration
  expiresAt: string; // TTL field for automatic cleanup
}

// ============================================================================
// DATA ACCESS LAYER INTERFACES
// ============================================================================

export interface DatabaseAccessLayer {
  // Template Operations
  getTemplate(templateId: string): Promise<PromptTemplatesTable>;
  getActiveTemplates(): Promise<PromptTemplatesTable[]>;
  getTemplatesByCategory(category: string): Promise<PromptTemplatesTable[]>;
  getTemplatesByIndustry(industry: string): Promise<PromptTemplatesTable[]>;
  createTemplate(template: PromptTemplatesTable): Promise<void>;
  updateTemplate(templateId: string, updates: Partial<PromptTemplatesTable>): Promise<void>;
  
  // Assistant Operations
  getAssistant(assistantId: string): Promise<UserAssistantsTable>;
  getUserAssistants(userId: string): Promise<UserAssistantsTable[]>;
  getAssistantsByStatus(status: string): Promise<UserAssistantsTable[]>;
  createAssistant(assistant: UserAssistantsTable): Promise<void>;
  updateAssistant(assistantId: string, updates: Partial<UserAssistantsTable>): Promise<void>;
  deleteAssistant(assistantId: string): Promise<void>;
  
  // Call Log Operations
  getCallLog(callId: string): Promise<CallLogsTable>;
  getCallsByAssistant(assistantId: string, limit?: number): Promise<CallLogsTable[]>;
  getCallsByUser(userId: string, startDate?: string, endDate?: string): Promise<CallLogsTable[]>;
  createCallLog(callLog: CallLogsTable): Promise<void>;
  updateCallLog(callId: string, updates: Partial<CallLogsTable>): Promise<void>;
  
  // Analytics Operations
  getTemplateAnalytics(templateId: string, period?: string): Promise<TemplateAnalyticsTable>;
  getPopularTemplates(periodType: string, limit?: number): Promise<TemplateAnalyticsTable[]>;
  updateTemplateAnalytics(analytics: TemplateAnalyticsTable): Promise<void>;
  
  // Session Operations
  getSession(sessionId: string): Promise<UserSessionsTable>;
  getUserSessions(userId: string): Promise<UserSessionsTable[]>;
  createSession(session: UserSessionsTable): Promise<void>;
  updateSession(sessionId: string, updates: Partial<UserSessionsTable>): Promise<void>;
}

// ============================================================================
// DYNAMODB TABLE CONFIGURATION
// ============================================================================

export const DynamoDBTableConfigurations = {
  PromptTemplates: {
    TableName: 'VoiceMatrix-PromptTemplates',
    BillingMode: 'PAY_PER_REQUEST', // On-demand for variable access patterns
    AttributeDefinitions: [
      { AttributeName: 'templateId', AttributeType: 'S' },
      { AttributeName: 'category', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'industry', AttributeType: 'S' },
      { AttributeName: 'usageCount', AttributeType: 'N' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'updatedAt', AttributeType: 'S' },
      { AttributeName: 'createdBy', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'templateId', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'Category-CreatedAt-Index',
        KeySchema: [
          { AttributeName: 'category', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'Industry-UsageCount-Index',
        KeySchema: [
          { AttributeName: 'industry', KeyType: 'HASH' },
          { AttributeName: 'usageCount', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'Status-UpdatedAt-Index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'updatedAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'CreatedBy-CreatedAt-Index',
        KeySchema: [
          { AttributeName: 'createdBy', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  },
  
  UserAssistants: {
    TableName: 'VoiceMatrix-UserAssistants',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'assistantId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'lastCallAt', AttributeType: 'S' },
      { AttributeName: 'templateId', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'assistantId', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserId-CreatedAt-Index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'Status-LastCallAt-Index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'lastCallAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'TemplateId-CreatedAt-Index',
        KeySchema: [
          { AttributeName: 'templateId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'UserId-Status-Index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'status', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    LocalSecondaryIndexes: [
      {
        IndexName: 'AssistantId-LastCallAt-Index',
        KeySchema: [
          { AttributeName: 'assistantId', KeyType: 'HASH' },
          { AttributeName: 'lastCallAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  },
  
  CallLogs: {
    TableName: 'VoiceMatrix-CallLogs',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'callId', AttributeType: 'S' },
      { AttributeName: 'assistantId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'startTime', AttributeType: 'S' },
      { AttributeName: 'yearMonth', AttributeType: 'S' },
      { AttributeName: 'templateId', AttributeType: 'S' },
      { AttributeName: 'callStatus', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'callId', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'AssistantId-StartTime-Index',
        KeySchema: [
          { AttributeName: 'assistantId', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'UserId-StartTime-Index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'YearMonth-StartTime-Index',
        KeySchema: [
          { AttributeName: 'yearMonth', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'TemplateId-StartTime-Index',
        KeySchema: [
          { AttributeName: 'templateId', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'CallStatus-StartTime-Index',
        KeySchema: [
          { AttributeName: 'callStatus', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    TimeToLiveSpecification: {
      AttributeName: 'dataRetentionDate',
      Enabled: true
    },
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  }
};

// ============================================================================
// PERFORMANCE OPTIMIZATION STRATEGIES
// ============================================================================

export const PerformanceOptimizations = {
  // Caching Strategy
  caching: {
    templates: {
      strategy: 'redis_cluster',
      ttl: 3600, // 1 hour for templates
      invalidation: 'stream_based', // Invalidate on DynamoDB streams
    },
    assistants: {
      strategy: 'application_cache',
      ttl: 300, // 5 minutes for assistants
      size_limit: 1000 // Cache up to 1000 assistants
    },
    analytics: {
      strategy: 'materialized_views',
      refresh_interval: 900, // 15 minutes
      aggregation_levels: ['hourly', 'daily', 'monthly']
    }
  },
  
  // Query Optimization
  queries: {
    batch_operations: true, // Use batch operations where possible
    parallel_queries: true, // Query multiple GSIs in parallel
    pagination: {
      default_limit: 25,
      max_limit: 100
    },
    projection_optimization: true // Only fetch required attributes
  },
  
  // Hot Partition Prevention
  partitioning: {
    call_logs: {
      strategy: 'time_based_sharding',
      shard_count: 10, // Distribute across 10 time-based shards
      rotation: 'monthly'
    },
    analytics: {
      strategy: 'composite_keys',
      distribution: 'hash_suffix' // Add hash suffix to distribute load
    }
  }
};

// ============================================================================
// BACKUP & DISASTER RECOVERY
// ============================================================================

export const BackupConfiguration = {
  point_in_time_recovery: true, // Enable PITR for all tables
  backup_schedule: {
    frequency: 'daily',
    retention: '30_days',
    cross_region: true
  },
  disaster_recovery: {
    rto: 60, // Recovery Time Objective: 1 hour
    rpo: 300, // Recovery Point Objective: 5 minutes
    strategy: 'multi_region_active_passive'
  }
};