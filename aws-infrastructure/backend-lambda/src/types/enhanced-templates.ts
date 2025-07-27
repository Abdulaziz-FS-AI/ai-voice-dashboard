/**
 * Enhanced Template System for VAPI Assistant Creation
 * Ultra-comprehensive template structure designed for business outcomes
 */

// ============================================================================
// CORE ENUMS & TYPES
// ============================================================================

export enum Industry {
  HEALTHCARE = 'healthcare',
  REAL_ESTATE = 'real_estate',
  SAAS = 'saas',
  ECOMMERCE = 'ecommerce',
  FINANCIAL_SERVICES = 'financial_services',
  PROFESSIONAL_SERVICES = 'professional_services',
  AUTOMOTIVE = 'automotive',
  EDUCATION = 'education',
  HOSPITALITY = 'hospitality',
  FITNESS = 'fitness',
  LEGAL = 'legal',
  INSURANCE = 'insurance',
  GENERAL = 'general'
}

export enum TemplateComplexity {
  BASIC = 'basic',           // 1-2 dynamic fields, simple flow
  INTERMEDIATE = 'intermediate', // 3-5 dynamic fields, moderate logic
  ADVANCED = 'advanced'      // 6+ dynamic fields, complex business rules
}

export enum ConversationObjective {
  LEAD_QUALIFICATION = 'lead_qualification',
  APPOINTMENT_BOOKING = 'appointment_booking',
  CUSTOMER_SUPPORT = 'customer_support',
  SALES_DISCOVERY = 'sales_discovery',
  SURVEY_COLLECTION = 'survey_collection',
  ORDER_PROCESSING = 'order_processing',
  TECHNICAL_SUPPORT = 'technical_support',
  INFORMATION_GATHERING = 'information_gathering'
}

// ============================================================================
// BUSINESS CONTEXT INTERFACES
// ============================================================================

export interface TemplateCategory {
  primary: 'sales' | 'support' | 'booking' | 'lead_qualification' | 'survey' | 'onboarding' | 'retention';
  secondary?: string;
  functionalArea: 'inbound' | 'outbound' | 'hybrid';
  interactionType: 'transactional' | 'consultative' | 'informational' | 'emergency';
}

export interface BusinessObjective {
  id: string;
  name: string;
  description: string;
  successCriteria: string[];
  priority: 'high' | 'medium' | 'low';
  measurable: boolean;
}

export interface UseCase {
  title: string;
  description: string;
  typicalScenarios: string[];
  expectedOutcomes: string[];
  avgCallDuration: number; // seconds
  successRate: number; // percentage
}

// ============================================================================
// ENHANCED SEGMENT SYSTEM
// ============================================================================

export interface EnhancedPromptSegment {
  id: string;
  type: 'foundation' | 'dynamic' | 'business_rule' | 'conversation_flow' | 'fallback';
  label: string;
  content: string;
  editable: boolean;
  
  // Enhanced Validation
  validation?: {
    type: 'required' | 'optional' | 'conditional';
    rules: ValidationRule[];
    dependencies?: string[]; // Other segment IDs this depends on
  };
  
  // Business Context
  businessPurpose: string;
  impactLevel: 'critical' | 'important' | 'nice_to_have';
  
  // User Experience
  placeholder?: string;
  helpText?: string;
  examples?: string[];
  characterLimit?: { min: number; max: number };
  
  // Conversation Flow
  triggers?: ConversationTrigger[];
  responses?: ConversationResponse[];
}

export interface ValidationRule {
  type: 'length' | 'format' | 'pattern' | 'business_logic' | 'required_if';
  value: string | number | RegExp;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ConversationTrigger {
  condition: string;
  action: 'escalate' | 'collect_info' | 'provide_info' | 'schedule_callback' | 'transfer';
  parameters?: Record<string, any>;
}

export interface ConversationResponse {
  scenario: string;
  responseTemplate: string;
  nextAction?: string;
}

// ============================================================================
// VAPI CONFIGURATION SYSTEM
// ============================================================================

export interface VAPIConfiguration {
  // Model Configuration
  model: {
    provider: 'openai' | 'anthropic' | 'groq';
    modelName: string;
    temperature: number;
    maxTokens: number;
    systemPromptOptimization: 'clarity' | 'brevity' | 'empathy' | 'authority';
  };
  
  // Voice Settings (Enhanced)
  voice: {
    provider: 'elevenlabs' | 'openai' | 'azure';
    voiceId: string;
    voiceName: string; // Human-readable name
    gender: 'male' | 'female' | 'neutral';
    age: 'young' | 'middle' | 'mature';
    accent: 'american' | 'british' | 'australian' | 'neutral';
    personality: 'professional' | 'friendly' | 'energetic' | 'calm';
    
    // Technical Settings
    speed: number;
    stability: number;
    clarity: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  
  // Conversation Flow
  conversationSettings: {
    firstMessage: string;
    endCallMessage: string;
    transferMessage?: string;
    holdMessage?: string;
    
    // Timing Controls
    maxDurationSeconds: number;
    silenceTimeoutSeconds: number;
    responseDelaySeconds: number;
    numWordsToInterruptAssistant: number;
    
    // Behavior Controls
    allowInterruptions: boolean;
    recordingEnabled: boolean;
    transcriptionEnabled: boolean;
  };
  
  // Business Rules Integration
  businessRules: {
    escalationTriggers: EscalationRule[];
    informationCollection: DataCollectionRule[];
    complianceSettings: ComplianceRule[];
  };
  
  // Webhook Configuration
  webhookSettings: {
    url: string;
    events: WebhookEvent[];
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
    };
  };
}

export interface EscalationRule {
  trigger: 'keyword' | 'sentiment' | 'duration' | 'confusion' | 'request';
  condition: string;
  action: 'transfer_to_human' | 'schedule_callback' | 'collect_contact' | 'end_call';
  message: string;
  priority: 'immediate' | 'high' | 'normal';
}

export interface DataCollectionRule {
  fieldName: string;
  required: boolean;
  validationPattern?: string;
  collectionPrompt: string;
  confirmationPrompt?: string;
  maxAttempts: number;
}

export interface ComplianceRule {
  type: 'gdpr' | 'hipaa' | 'tcpa' | 'custom';
  requirement: string;
  enforcement: 'strict' | 'flexible';
  disclaimerText?: string;
}

export enum WebhookEvent {
  CALL_START = 'call_start',
  CALL_END = 'call_end',
  TRANSFER_INITIATED = 'transfer_initiated',
  DATA_COLLECTED = 'data_collected',
  ESCALATION_TRIGGERED = 'escalation_triggered'
}

// ============================================================================
// PERFORMANCE & ANALYTICS
// ============================================================================

export interface PerformanceConfiguration {
  // Key Performance Indicators
  kpis: {
    primaryMetric: 'call_completion_rate' | 'satisfaction_score' | 'conversion_rate' | 'resolution_rate';
    secondaryMetrics: string[];
    benchmarkTargets: Record<string, number>;
  };
  
  // Analytics Settings
  analytics: {
    trackConversationFlow: boolean;
    trackSentimentChanges: boolean;
    trackObjectiveCompletion: boolean;
    generateInsights: boolean;
  };
  
  // A/B Testing Configuration
  experimentSettings?: {
    enabled: boolean;
    variants: TemplateVariant[];
    trafficSplit: number[]; // percentage allocation
    successMetric: string;
  };
}

export interface TemplateVariant {
  id: string;
  name: string;
  changes: SegmentChange[];
  hypothesis: string;
}

export interface SegmentChange {
  segmentId: string;
  changeType: 'content' | 'voice_setting' | 'business_rule';
  newValue: any;
}

// ============================================================================
// MAIN TEMPLATE INTERFACE
// ============================================================================

export interface EnhancedPromptTemplate {
  // Core Identity
  id: string;
  name: string;
  version: string;
  status: 'active' | 'deprecated' | 'beta' | 'draft';
  
  // Business Context
  category: TemplateCategory;
  industry: Industry[];
  useCase: UseCase;
  complexity: TemplateComplexity;
  businessObjectives: BusinessObjective[];
  
  // Template Structure
  segments: EnhancedPromptSegment[];
  
  // VAPI Integration
  vapiConfiguration: VAPIConfiguration;
  
  // Performance & Analytics
  performanceConfig: PerformanceConfiguration;
  
  // User Experience
  userExperience: {
    estimatedSetupTime: number; // minutes
    requiredSkills: string[];
    difficulty: 'beginner' | 'intermediate' | 'expert';
    prerequisites: string[];
  };
  
  // Template Management
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    tags: string[];
    parentTemplateId?: string; // for inheritance
    childTemplateIds?: string[]; // for composed templates
    usage: {
      timesUsed: number;
      averageRating: number;
      lastUsed: string;
    };
  };
  
  // Documentation
  documentation: {
    description: string;
    detailedInstructions: string;
    bestPractices: string[];
    commonPitfalls: string[];
    successStories: SuccessStory[];
  };
}

export interface SuccessStory {
  company: string;
  industry: string;
  challenge: string;
  solution: string;
  results: string;
  metrics: Record<string, number>;
}

// ============================================================================
// TEMPLATE CREATION & MANAGEMENT
// ============================================================================

export interface TemplateCreationRequest {
  baseTemplateId?: string; // for inheritance
  customizations: TemplateCustomization[];
  businessContext: BusinessContextInput;
  vapiPreferences: VAPIPreferences;
}

export interface TemplateCustomization {
  segmentId: string;
  customValue: string;
  reasoning?: string;
}

export interface BusinessContextInput {
  companyName: string;
  industry: Industry;
  primaryObjective: ConversationObjective;
  targetAudience: string;
  brandVoice: 'professional' | 'casual' | 'friendly' | 'authoritative';
  complianceRequirements: string[];
}

export interface VAPIPreferences {
  voiceGender: 'male' | 'female' | 'no_preference';
  voicePersonality: 'professional' | 'friendly' | 'energetic' | 'calm';
  callDurationTarget: 'quick' | 'thorough' | 'flexible';
  escalationFrequency: 'minimal' | 'moderate' | 'frequent';
}

// ============================================================================
// TEMPLATE VALIDATION & OPTIMIZATION
// ============================================================================

export interface TemplateValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: OptimizationSuggestion[];
  score: {
    overall: number;
    categories: {
      completeness: number;
      clarity: number;
      businessAlignment: number;
      technicalQuality: number;
    };
  };
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  suggestedFix?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  recommendation: string;
  impact: 'performance' | 'user_experience' | 'compliance';
}

export interface OptimizationSuggestion {
  type: 'performance' | 'user_experience' | 'business_outcome';
  description: string;
  expectedImpact: 'high' | 'medium' | 'low';
  implementationEffort: 'low' | 'medium' | 'high';
  action: string;
}