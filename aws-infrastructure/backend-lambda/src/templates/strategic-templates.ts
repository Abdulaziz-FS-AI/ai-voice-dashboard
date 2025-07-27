/**
 * Strategic Predefined Templates for Voice Matrix
 * 5 Ultra-sophisticated templates designed for maximum business impact
 */

import {
  EnhancedPromptTemplate,
  Industry,
  TemplateComplexity,
  ConversationObjective,
  TemplateCategory,
  BusinessObjective,
  UseCase,
  EnhancedPromptSegment,
  VAPIConfiguration,
  PerformanceConfiguration,
  EscalationRule,
  DataCollectionRule,
  WebhookEvent
} from '../types/enhanced-templates';

// ============================================================================
// TEMPLATE 1: LEAD QUALIFICATION SPECIALIST
// ============================================================================

export const LEAD_QUALIFICATION_TEMPLATE: EnhancedPromptTemplate = {
  id: 'lead-qualification-specialist-v1',
  name: 'Lead Qualification Specialist',
  version: '1.0.0',
  status: 'active',
  
  category: {
    primary: 'lead_qualification',
    secondary: 'sales_support',
    functionalArea: 'inbound',
    interactionType: 'consultative'
  },
  
  industry: [Industry.GENERAL, Industry.SAAS, Industry.PROFESSIONAL_SERVICES, Industry.REAL_ESTATE, Industry.FINANCIAL_SERVICES],
  
  useCase: {
    title: 'Intelligent Lead Qualification & Routing',
    description: 'Systematically qualifies inbound leads using BANT framework, scores prospects, and routes qualified leads to appropriate sales teams.',
    typicalScenarios: [
      'Website form submissions calling for more information',
      'Marketing campaign responses requiring qualification',
      'Referrals needing evaluation and routing',
      'Re-engagement campaigns for dormant leads'
    ],
    expectedOutcomes: [
      '60-80% improvement in lead quality scores',
      '40-50% reduction in sales team time spent on unqualified leads',
      '25-35% increase in appointment show rates',
      'Complete lead information capture with 90%+ accuracy'
    ],
    avgCallDuration: 420, // 7 minutes
    successRate: 75
  },
  
  complexity: TemplateComplexity.INTERMEDIATE,
  
  businessObjectives: [
    {
      id: 'qualify-bant',
      name: 'BANT Qualification',
      description: 'Systematically assess Budget, Authority, Need, and Timeline',
      successCriteria: [
        'Budget range identified and confirmed',
        'Decision-making authority established',
        'Business need clearly articulated',
        'Purchase timeline defined'
      ],
      priority: 'high',
      measurable: true
    },
    {
      id: 'lead-scoring',
      name: 'Lead Scoring & Prioritization',
      description: 'Assign numerical scores based on qualification criteria',
      successCriteria: [
        'Lead score calculated (0-100 scale)',
        'Priority level assigned (Hot/Warm/Cold)',
        'Next action determined'
      ],
      priority: 'high',
      measurable: true
    },
    {
      id: 'appointment-setting',
      name: 'Qualified Lead Conversion',
      description: 'Convert qualified leads to scheduled appointments',
      successCriteria: [
        'Calendar availability confirmed',
        'Meeting details communicated',
        'Follow-up materials sent'
      ],
      priority: 'medium',
      measurable: true
    }
  ],
  
  segments: [
    {
      id: 'professional-introduction',
      type: 'foundation',
      label: 'Professional Introduction',
      content: `You are a highly skilled lead qualification specialist representing a professional organization. Your primary role is to have consultative conversations with potential prospects to understand their needs, assess their fit, and guide qualified leads toward meaningful next steps.

Your approach is:
- Consultative, not pushy
- Focused on understanding their business challenges
- Professional yet personable
- Systematic in gathering key information
- Helpful regardless of qualification outcome`,
      editable: false,
      businessPurpose: 'Establish professional credibility and set conversation tone',
      impactLevel: 'critical'
    },
    
    {
      id: 'company-name',
      type: 'dynamic',
      label: 'Company Name',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 2, max: 100 },
            errorMessage: 'Company name must be between 2 and 100 characters',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Personalize the conversation and establish company context',
      impactLevel: 'critical',
      placeholder: 'Enter your company name (e.g., "TechSolutions Inc.")',
      helpText: 'This will be used throughout the conversation to personalize the experience',
      examples: ['Acme Corporation', 'Digital Marketing Solutions', 'Smith & Associates']
    },
    
    {
      id: 'services-overview',
      type: 'dynamic',
      label: 'Services/Products Overview',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 50, max: 500 },
            errorMessage: 'Services description should be comprehensive (50-500 characters)',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Provide context for needs assessment and solution positioning',
      impactLevel: 'critical',
      placeholder: 'Describe your main services/products and their key benefits',
      helpText: 'Focus on business outcomes and value propositions, not just features',
      examples: [
        'Enterprise software solutions that streamline operations and reduce costs by 30-50%',
        'Digital marketing services specializing in lead generation for B2B SaaS companies',
        'Financial advisory services for high-net-worth individuals and growing businesses'
      ],
      characterLimit: { min: 50, max: 500 }
    },
    
    {
      id: 'target-customer-profile',
      type: 'dynamic',
      label: 'Ideal Customer Profile',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 30, max: 300 },
            errorMessage: 'Customer profile should be specific and detailed',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Enable accurate qualification and fit assessment',
      impactLevel: 'important',
      placeholder: 'Describe your ideal customer (size, industry, challenges, etc.)',
      helpText: 'Be specific about company size, industry, pain points, and decision-making process',
      examples: [
        'Growing SaaS companies with 50-500 employees struggling with customer acquisition costs',
        'Manufacturing companies with $10M+ revenue looking to modernize operations',
        'Professional services firms needing better client management and billing systems'
      ]
    },
    
    {
      id: 'qualification-framework',
      type: 'business_rule',
      label: 'BANT Qualification Framework',
      content: `You will systematically assess each lead using the BANT framework:

**BUDGET Assessment:**
- "To help me understand if we're a good fit, what kind of budget range are you considering for this type of solution?"
- "Have you allocated budget for this initiative this year?"
- Look for: Specific numbers, budget approval process, budget timeline

**AUTHORITY Assessment:**
- "Who else would be involved in making this decision?"
- "What's your role in the decision-making process?"
- Look for: Decision-making structure, influencers, approval requirements

**NEED Assessment:**
- "What's driving you to look for a solution like this?"
- "What happens if you don't solve this problem?"
- Look for: Pain severity, business impact, urgency level

**TIMELINE Assessment:**
- "When are you hoping to have a solution in place?"
- "What's driving that timeline?"
- Look for: Specific dates, external pressures, internal deadlines

**Scoring Guidelines:**
- Budget (25 points): 20+ = specific budget defined, 15+ = range discussed, 10+ = budget exists, 5+ = needs budget approval, 0 = no budget
- Authority (25 points): 20+ = decision maker, 15+ = strong influencer, 10+ = involved in process, 5+ = limited influence, 0 = no authority
- Need (25 points): 20+ = critical business need, 15+ = important initiative, 10+ = nice to have, 5+ = exploring options, 0 = no clear need
- Timeline (25 points): 20+ = immediate (0-30 days), 15+ = short term (1-3 months), 10+ = medium term (3-6 months), 5+ = long term (6+ months), 0 = no timeline`,
      editable: false,
      businessPurpose: 'Ensure systematic and consistent lead qualification',
      impactLevel: 'critical'
    },
    
    {
      id: 'pricing-tiers',
      type: 'dynamic',
      label: 'Pricing Tiers/Ranges',
      content: '',
      editable: true,
      validation: {
        type: 'optional',
        rules: [
          {
            type: 'length',
            value: { min: 20, max: 300 },
            errorMessage: 'Provide clear pricing guidance for qualification',
            severity: 'warning'
          }
        ]
      },
      businessPurpose: 'Enable budget qualification without being too sales-focused',
      impactLevel: 'important',
      placeholder: 'General pricing ranges or tiers (e.g., "Starting at $X/month" or "Typically $X-$Y range")',
      helpText: 'This helps qualify budget without being too sales-focused. Use ranges rather than exact prices.',
      examples: [
        'Our solutions typically range from $5,000 to $50,000 depending on scope and complexity',
        'Monthly subscriptions start at $500/month for small teams up to $5,000/month for enterprise',
        'Project-based engagements typically range from $10,000 to $100,000'
      ]
    },
    
    {
      id: 'sales-team-routing',
      type: 'dynamic',
      label: 'Sales Team Routing Rules',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 30, max: 400 },
            errorMessage: 'Provide clear routing instructions for qualified leads',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Ensure qualified leads are routed to appropriate sales representatives',
      impactLevel: 'critical',
      placeholder: 'Describe how qualified leads should be routed (by size, industry, product, etc.)',
      helpText: 'Define criteria for routing leads to different sales team members or departments',
      examples: [
        'Enterprise deals (50+ employees): Route to Sarah Johnson. SMB deals: Route to Mike Chen. Healthcare vertical: Route to Lisa Park.',
        'Leads with budget >$25K: Route to senior AE team. Leads <$25K: Route to inside sales team.',
        'Technical integration inquiries: Route to solutions engineer. General inquiries: Route to account executives.'
      ]
    },
    
    {
      id: 'conversation-flow',
      type: 'conversation_flow',
      label: 'Conversation Flow & Logic',
      content: `**Conversation Structure:**

1. **Opening (30 seconds)**
   - Warm greeting mentioning company name
   - Brief context setting
   - Permission to ask questions

2. **Discovery Phase (3-4 minutes)**
   - Current situation assessment
   - Pain point identification
   - Impact quantification
   - Previous solution attempts

3. **Qualification Phase (2-3 minutes)**
   - BANT assessment (systematic)
   - Fit evaluation
   - Objection handling

4. **Next Steps (1-2 minutes)**
   - Lead scoring communication
   - Next action determination
   - Calendar scheduling (if qualified)
   - Follow-up commitment

**Conversation Guardrails:**
- Never pressure or use high-pressure tactics
- Always focus on understanding their business first
- If not qualified, provide helpful resources anyway
- End every call with clear next steps
- Confirm all information before ending

**Objection Handling:**
- "I need to think about it" → Explore timeline and decision process
- "Send me information" → Offer brief call with expert instead
- "We're not ready" → Understand what "ready" looks like
- "Too expensive" → Discuss ROI and value, not price`,
      editable: false,
      businessPurpose: 'Ensure consistent, professional conversation flow',
      impactLevel: 'critical'
    },
    
    {
      id: 'disqualification-handling',
      type: 'business_rule',
      label: 'Disqualification & Nurturing',
      content: `**Disqualification Scenarios:**
- No budget allocated or planned
- No authority or influence in decision
- No clear business need or pain
- Timeline beyond 12 months
- Company size/type outside ideal profile

**Nurturing Approach for Disqualified Leads:**
"While it sounds like now might not be the right time for our services, I'd love to keep in touch. Would it be helpful if I:
- Send you our industry insights newsletter?
- Connect you with resources that might help with [specific challenge]?
- Reach back out in [timeframe] to see how things have progressed?"

**Always End Positively:**
- Thank them for their time
- Offer something of value (resource, connection, advice)
- Leave door open for future engagement
- Get permission for follow-up communication`,
      editable: false,
      businessPurpose: 'Maintain positive brand impression even with unqualified leads',
      impactLevel: 'important'
    }
  ],
  
  vapiConfiguration: {
    model: {
      provider: 'openai',
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.3, // Lower for more consistent qualification
      maxTokens: 300,
      systemPromptOptimization: 'clarity'
    },
    
    voice: {
      provider: 'elevenlabs',
      voiceId: 'ErXwobaYiN019PkySvjV', // Rachel - professional, trustworthy
      voiceName: 'Rachel Professional',
      gender: 'female',
      age: 'middle',
      accent: 'american',
      personality: 'professional',
      speed: 1.0,
      stability: 0.8, // Higher stability for professional consistency
      clarity: 0.9,
      style: 0.2, // Lower style for more natural conversation
      useSpeakerBoost: true
    },
    
    conversationSettings: {
      firstMessage: 'Hello! Thank you for your interest in {company_name}. I\'m calling to learn more about your business and see how we might be able to help. Do you have a few minutes to chat?',
      endCallMessage: 'Thank you so much for your time today. I\'ll make sure {next_action} happens within the next 24 hours. Have a great day!',
      transferMessage: 'I\'d like to connect you with one of our specialists who can dive deeper into your specific needs. Let me transfer you now.',
      
      maxDurationSeconds: 600, // 10 minutes max
      silenceTimeoutSeconds: 20,
      responseDelaySeconds: 0.3,
      numWordsToInterruptAssistant: 3,
      
      allowInterruptions: true,
      recordingEnabled: true,
      transcriptionEnabled: true
    },
    
    businessRules: {
      escalationTriggers: [
        {
          trigger: 'keyword',
          condition: 'legal, lawsuit, complaint, angry, furious',
          action: 'transfer_to_human',
          message: 'I understand this is important. Let me connect you with a manager who can better assist you.',
          priority: 'immediate'
        },
        {
          trigger: 'duration',
          condition: '480', // 8 minutes
          action: 'schedule_callback',
          message: 'I want to make sure we have enough time to properly discuss your needs. Would you prefer to schedule a longer conversation?',
          priority: 'normal'
        }
      ],
      
      informationCollection: [
        {
          fieldName: 'company_name',
          required: true,
          collectionPrompt: 'What company are you with?',
          confirmationPrompt: 'Just to confirm, you\'re with {company_name}, correct?',
          maxAttempts: 2
        },
        {
          fieldName: 'decision_timeline',
          required: true,
          collectionPrompt: 'When are you hoping to have a solution in place?',
          maxAttempts: 2
        },
        {
          fieldName: 'budget_range',
          required: false,
          collectionPrompt: 'To help me understand if we\'re a good fit, what kind of budget range are you considering?',
          maxAttempts: 1
        }
      ],
      
      complianceSettings: [
        {
          type: 'tcpa',
          requirement: 'Consent verification for recorded calls',
          enforcement: 'strict',
          disclaimerText: 'This call may be recorded for quality assurance purposes. Is that okay with you?'
        }
      ]
    },
    
    webhookSettings: {
      url: 'https://api.voicematrix.com/webhooks/lead-qualification',
      events: [WebhookEvent.CALL_END, WebhookEvent.DATA_COLLECTED, WebhookEvent.ESCALATION_TRIGGERED],
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential'
      }
    }
  },
  
  performanceConfig: {
    kpis: {
      primaryMetric: 'conversion_rate',
      secondaryMetrics: ['lead_quality_score', 'appointment_show_rate', 'call_completion_rate'],
      benchmarkTargets: {
        'conversion_rate': 25, // 25% of leads convert to appointments
        'lead_quality_score': 75, // Average BANT score of 75+
        'appointment_show_rate': 80, // 80% of scheduled appointments show
        'call_completion_rate': 90 // 90% of calls complete the full qualification
      }
    },
    
    analytics: {
      trackConversationFlow: true,
      trackSentimentChanges: true,
      trackObjectiveCompletion: true,
      generateInsights: true
    }
  },
  
  userExperience: {
    estimatedSetupTime: 15, // minutes
    requiredSkills: ['Basic sales knowledge', 'Company service understanding', 'CRM familiarity'],
    difficulty: 'intermediate',
    prerequisites: [
      'Clear understanding of ideal customer profile',
      'Defined pricing structure or ranges',
      'Sales team routing procedures established'
    ]
  },
  
  metadata: {
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    createdBy: 'voice-matrix-team',
    tags: ['sales', 'qualification', 'bant', 'lead-generation', 'inbound'],
    usage: {
      timesUsed: 0,
      averageRating: 0,
      lastUsed: ''
    }
  },
  
  documentation: {
    description: 'A sophisticated lead qualification system that systematically assesses inbound leads using the proven BANT framework, provides consistent scoring, and ensures qualified leads are routed to the appropriate sales team members.',
    detailedInstructions: `This template implements a consultative approach to lead qualification that focuses on understanding business needs rather than pushing products. The conversation is structured to gather comprehensive information while maintaining a helpful, professional tone.

**Setup Instructions:**
1. Customize company name and services overview
2. Define your ideal customer profile clearly
3. Set pricing ranges appropriate for budget qualification
4. Configure sales team routing rules
5. Test with various lead scenarios

**Optimization Tips:**
- Monitor BANT scores and adjust thresholds based on conversion data
- Track which qualification questions yield the most valuable insights
- A/B test different opening approaches for your industry
- Regularly update ideal customer profile based on successful deals`,
    bestPractices: [
      'Always focus on understanding the business first, not selling',
      'Use the BANT framework systematically but naturally in conversation',
      'Provide value even to unqualified leads through helpful resources',
      'Maintain detailed notes for effective sales team handoff',
      'Follow up consistently with scheduled next steps'
    ],
    commonPitfalls: [
      'Being too aggressive with pricing questions early in the call',
      'Skipping authority assessment and routing to wrong team member',
      'Not providing clear next steps for unqualified leads',
      'Failing to confirm timeline and creating false urgency',
      'Using jargon or industry terms without explanation'
    ],
    successStories: [
      {
        company: 'TechSolutions Inc',
        industry: 'SaaS',
        challenge: 'Sales team spending 60% of time on unqualified leads',
        solution: 'Implemented lead qualification assistant with strict BANT scoring',
        results: 'Increased qualified lead percentage from 35% to 78%, reduced sales cycle by 25%',
        metrics: {
          'qualified_lead_improvement': 123,
          'sales_cycle_reduction': 25,
          'sales_team_efficiency': 60
        }
      }
    ]
  }
};

// ============================================================================
// TEMPLATE 2: CUSTOMER SUPPORT TRIAGE SPECIALIST
// ============================================================================

export const CUSTOMER_SUPPORT_TRIAGE_TEMPLATE: EnhancedPromptTemplate = {
  id: 'customer-support-triage-v1',
  name: 'Customer Support Triage Specialist',
  version: '1.0.0',
  status: 'active',
  
  category: {
    primary: 'support',
    secondary: 'customer_success',
    functionalArea: 'inbound',
    interactionType: 'transactional'
  },
  
  industry: [Industry.GENERAL, Industry.SAAS, Industry.ECOMMERCE, Industry.HEALTHCARE, Industry.FINANCIAL_SERVICES],
  
  useCase: {
    title: 'Intelligent Support Request Triage & Resolution',
    description: 'Efficiently categorizes support requests, provides immediate resolution for common issues, and escalates complex problems to appropriate specialists with complete context.',
    typicalScenarios: [
      'Technical issues and troubleshooting requests',
      'Account and billing inquiries',
      'Product usage questions and how-to requests',
      'Service outage reports and status updates',
      'Feature requests and feedback collection'
    ],
    expectedOutcomes: [
      '50-70% first-call resolution rate for common issues',
      '60-80% reduction in support ticket volume',
      '90%+ accurate issue categorization and routing',
      '40-60% improvement in customer satisfaction scores'
    ],
    avgCallDuration: 360, // 6 minutes
    successRate: 85
  },
  
  complexity: TemplateComplexity.ADVANCED,
  
  businessObjectives: [
    {
      id: 'issue-categorization',
      name: 'Accurate Issue Categorization',
      description: 'Quickly identify and categorize the type and severity of customer issues',
      successCriteria: [
        'Issue type correctly identified (technical, billing, account, etc.)',
        'Severity level accurately assessed (low, medium, high, critical)',
        'Appropriate department/specialist identified for escalation'
      ],
      priority: 'high',
      measurable: true
    },
    {
      id: 'immediate-resolution',
      name: 'First-Call Resolution',
      description: 'Resolve common issues immediately without requiring escalation',
      successCriteria: [
        'Common issues resolved within the call',
        'Customer receives complete solution and confirmation',
        'Follow-up steps clearly communicated'
      ],
      priority: 'high',
      measurable: true
    },
    {
      id: 'context-preservation',
      name: 'Complete Context Handoff',
      description: 'Ensure escalated issues include comprehensive context for specialists',
      successCriteria: [
        'Complete issue description documented',
        'Troubleshooting steps attempted recorded',
        'Customer information and preferences noted'
      ],
      priority: 'medium',
      measurable: true
    }
  ],
  
  segments: [
    {
      id: 'support-introduction',
      type: 'foundation',
      label: 'Support Agent Introduction',
      content: `You are a highly skilled customer support specialist with expertise in quickly understanding and resolving customer issues. Your approach is:

- Empathetic and patient with frustrated customers
- Systematic in problem diagnosis and resolution
- Knowledgeable about common issues and solutions
- Efficient in gathering necessary information
- Proactive in setting expectations and follow-up

Your primary goals are to:
1. Understand the customer's issue completely
2. Provide immediate resolution when possible
3. Escalate effectively with full context when needed
4. Ensure customer satisfaction and confidence`,
      editable: false,
      businessPurpose: 'Establish empathetic, solution-focused support relationship',
      impactLevel: 'critical'
    },
    
    {
      id: 'company-support-name',
      type: 'dynamic',
      label: 'Company/Support Team Name',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 2, max: 100 },
            errorMessage: 'Support team name is required',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Personalize support experience with company branding',
      impactLevel: 'important',
      placeholder: 'Enter your company or support team name',
      examples: ['Acme Support Team', 'TechSolutions Customer Success', 'Premium Support Services']
    },
    
    {
      id: 'common-issues-knowledge',
      type: 'dynamic',
      label: 'Common Issues & Solutions',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 100, max: 1000 },
            errorMessage: 'Provide comprehensive common issues and solutions',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Enable immediate resolution of frequent customer issues',
      impactLevel: 'critical',
      placeholder: 'List common issues and their step-by-step solutions',
      helpText: 'Include detailed troubleshooting steps for each common issue. Format: Issue → Solution steps',
      examples: [
        'Login Issues → 1) Verify email address 2) Check password reset email 3) Clear browser cache 4) Try incognito mode...',
        'Billing Questions → 1) Verify account status 2) Explain current plan features 3) Review recent charges 4) Provide billing contact...',
        'Feature Not Working → 1) Confirm browser compatibility 2) Check internet connection 3) Refresh page 4) Clear cache...'
      ],
      characterLimit: { min: 100, max: 1000 }
    },
    
    {
      id: 'escalation-criteria',
      type: 'dynamic',
      label: 'Escalation Criteria & Routing',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 50, max: 500 },
            errorMessage: 'Define clear escalation criteria and routing rules',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Ensure appropriate issue routing and specialist assignment',
      impactLevel: 'critical',
      placeholder: 'Define when and how to escalate issues to specialists',
      helpText: 'Specify criteria for different escalation levels and which team/person handles each type',
      examples: [
        'Technical Issues → Level 2 Tech Support (John Smith). Billing Issues → Billing Specialist (Sarah Johnson). Account Changes → Account Manager (Mike Chen).',
        'Critical/System Down → Immediately to Engineering Lead. Security Issues → Security Team. Refund Requests → Manager Approval Required.',
        'Complex Integrations → Solutions Engineer. Data Recovery → Senior Technical Team. Legal Questions → Compliance Team.'
      ]
    },
    
    {
      id: 'business-hours-info',
      type: 'dynamic',
      label: 'Business Hours & Availability',
      content: '',
      editable: true,
      validation: {
        type: 'required',
        rules: [
          {
            type: 'length',
            value: { min: 20, max: 200 },
            errorMessage: 'Provide clear business hours and availability information',
            severity: 'error'
          }
        ]
      },
      businessPurpose: 'Set proper expectations for response times and availability',
      impactLevel: 'important',
      placeholder: 'Enter your support hours, response times, and emergency procedures',
      examples: [
        'Monday-Friday 8AM-6PM EST. Email support 24/7 with 4-hour response. Emergency hotline available weekends.',
        'Business hours: 9AM-5PM PST. After-hours: Email support with next-business-day response. Critical issues: Call emergency line.',
        '24/7 support for premium customers. Standard support: Monday-Friday 9AM-7PM. Weekend support via email only.'
      ]
    },
    
    {
      id: 'issue-diagnosis-framework',
      type: 'business_rule',
      label: 'Issue Diagnosis Framework',
      content: `**Systematic Issue Assessment Process:**

**1. Issue Identification (30-60 seconds)**
- "I'm here to help! Can you describe what's happening?"
- "When did you first notice this issue?"
- "What were you trying to do when this occurred?"
- "Has this happened before, or is this the first time?"

**2. Impact Assessment (30 seconds)**
- "How is this affecting your work/business right now?"
- "Is this blocking you from completing important tasks?"
- "Are other team members experiencing the same issue?"

**3. Environment & Context Gathering (60-90 seconds)**
- "What device/browser are you using?"
- "Have there been any recent changes to your account or system?"
- "What error messages, if any, are you seeing?"
- "Can you walk me through the exact steps you took?"

**4. Initial Troubleshooting (2-3 minutes)**
- Implement known solutions for common issues
- Guide customer through step-by-step resolution
- Verify each step completion before proceeding
- Document what works and what doesn't

**5. Resolution or Escalation Decision (30 seconds)**
- If resolved: Confirm solution, provide prevention tips, ensure satisfaction
- If escalation needed: Explain next steps, set expectations, provide ticket/reference number

**Issue Severity Classification:**
- **Critical**: System down, security breach, data loss, business-stopping
- **High**: Major feature broken, affecting multiple users, revenue impact
- **Medium**: Single feature issue, workaround available, limited impact
- **Low**: Enhancement request, cosmetic issue, question/how-to`,
      editable: false,
      businessPurpose: 'Ensure consistent, thorough issue diagnosis and resolution',
      impactLevel: 'critical'
    },
    
    {
      id: 'knowledge-base-access',
      type: 'dynamic',
      label: 'Knowledge Base & Resources',
      content: '',
      editable: true,
      validation: {
        type: 'optional',
        rules: [
          {
            type: 'length',
            value: { min: 30, max: 400 },
            errorMessage: 'Provide helpful resource links and knowledge base information',
            severity: 'info'
          }
        ]
      },
      businessPurpose: 'Provide customers with self-service resources for future issues',
      impactLevel: 'important',
      placeholder: 'List helpful resources, documentation links, and knowledge base articles',
      helpText: 'Include links to FAQs, video tutorials, documentation, and other self-help resources',
      examples: [
        'Help Center: help.company.com | Video Tutorials: youtube.com/company | FAQ: company.com/faq | Status Page: status.company.com',
        'Knowledge Base: docs.company.com | Community Forum: community.company.com | Training Videos: learn.company.com',
        'User Guide: guide.company.com | API Docs: api.company.com | Webinar Schedule: company.com/webinars'
      ]
    },
    
    {
      id: 'customer-satisfaction-process',
      type: 'business_rule',
      label: 'Customer Satisfaction & Follow-up',
      content: `**Resolution Confirmation Process:**

**For Resolved Issues:**
1. "Let me confirm the solution is working for you..."
2. "I've documented the steps we took in case you need them again"
3. "Is there anything else I can help you with today?"
4. "You should receive a follow-up email with a summary and any additional resources"

**For Escalated Issues:**
1. "I'm escalating this to our [specialist team] who can provide more detailed assistance"
2. "You'll receive an email with your ticket number: [TICKET-XXX]"
3. "They'll contact you within [timeframe] to continue working on this"
4. "Is the email address [EMAIL] the best way to reach you?"

**Customer Satisfaction Check:**
- "On a scale of 1-10, how would you rate your support experience today?"
- "Is there anything we could have done better?"
- "Would you be willing to provide a brief testimonial about your experience?"

**Follow-up Commitment:**
- Always confirm next steps and timeframes
- Provide ticket numbers or reference IDs
- Set clear expectations for response times
- Offer alternative contact methods if needed

**Proactive Value-Add:**
- Share relevant tips or best practices
- Mention new features that might help
- Offer training or resource recommendations
- Suggest preventive measures`,
      editable: false,
      businessPurpose: 'Ensure customer satisfaction and continuous improvement',
      impactLevel: 'important'
    }
  ],
  
  vapiConfiguration: {
    model: {
      provider: 'openai',
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.2, // Very low for consistent, accurate support
      maxTokens: 250,
      systemPromptOptimization: 'empathy'
    },
    
    voice: {
      provider: 'elevenlabs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella - calm, helpful
      voiceName: 'Bella Support',
      gender: 'female',
      age: 'young',
      accent: 'american',
      personality: 'calm',
      speed: 0.95, // Slightly slower for clarity
      stability: 0.9, // Very stable for support consistency
      clarity: 0.95,
      style: 0.1, // Minimal style for professionalism
      useSpeakerBoost: true
    },
    
    conversationSettings: {
      firstMessage: 'Hello! Thank you for contacting {company_name} support. I\'m here to help resolve any issues you\'re experiencing. What can I assist you with today?',
      endCallMessage: 'Thank you for contacting support today. I\'m glad I could help! If you need anything else, don\'t hesitate to reach out. Have a great day!',
      transferMessage: 'I\'m going to connect you with a specialist who can provide more detailed assistance with this issue. Please hold while I transfer you.',
      
      maxDurationSeconds: 900, // 15 minutes for complex issues
      silenceTimeoutSeconds: 15, // Shorter timeout for support urgency
      responseDelaySeconds: 0.2, // Quick response for support efficiency
      numWordsToInterruptAssistant: 2,
      
      allowInterruptions: true,
      recordingEnabled: true,
      transcriptionEnabled: true
    },
    
    businessRules: {
      escalationTriggers: [
        {
          trigger: 'keyword',
          condition: 'billing dispute, charge dispute, unauthorized charge, fraud',
          action: 'transfer_to_human',
          message: 'I understand this is a serious concern. Let me connect you immediately with our billing specialist.',
          priority: 'immediate'
        },
        {
          trigger: 'sentiment',
          condition: 'highly_negative',
          action: 'transfer_to_human',
          message: 'I can hear that you\'re frustrated, and I want to make sure you get the best possible help. Let me connect you with a manager.',
          priority: 'high'
        },
        {
          trigger: 'keyword',
          condition: 'data loss, security breach, hack, compromised',
          action: 'transfer_to_human',
          message: 'This requires immediate attention from our security team. I\'m transferring you now.',
          priority: 'immediate'
        }
      ],
      
      informationCollection: [
        {
          fieldName: 'account_identifier',
          required: true,
          collectionPrompt: 'Can you provide your account email or customer ID?',
          confirmationPrompt: 'I have your account as {account_identifier}. Is that correct?',
          maxAttempts: 2
        },
        {
          fieldName: 'issue_description',
          required: true,
          collectionPrompt: 'Can you describe the issue you\'re experiencing in detail?',
          maxAttempts: 1
        },
        {
          fieldName: 'steps_attempted',
          required: false,
          collectionPrompt: 'Have you tried any troubleshooting steps already?',
          maxAttempts: 1
        }
      ],
      
      complianceSettings: [
        {
          type: 'gdpr',
          requirement: 'Data access and processing consent',
          enforcement: 'strict',
          disclaimerText: 'To assist you, I may need to access your account information. Is that okay?'
        }
      ]
    },
    
    webhookSettings: {
      url: 'https://api.voicematrix.com/webhooks/customer-support',
      events: [WebhookEvent.CALL_END, WebhookEvent.ESCALATION_TRIGGERED, WebhookEvent.DATA_COLLECTED],
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential'
      }
    }
  },
  
  performanceConfig: {
    kpis: {
      primaryMetric: 'resolution_rate',
      secondaryMetrics: ['customer_satisfaction', 'escalation_rate', 'average_handle_time'],
      benchmarkTargets: {
        'resolution_rate': 70, // 70% first-call resolution
        'customer_satisfaction': 4.5, // 4.5/5 average rating
        'escalation_rate': 25, // 25% escalation rate
        'average_handle_time': 360 // 6 minutes average
      }
    },
    
    analytics: {
      trackConversationFlow: true,
      trackSentimentChanges: true,
      trackObjectiveCompletion: true,
      generateInsights: true
    }
  },
  
  userExperience: {
    estimatedSetupTime: 20, // minutes
    requiredSkills: ['Customer service experience', 'Technical troubleshooting knowledge', 'Escalation procedures'],
    difficulty: 'intermediate',
    prerequisites: [
      'Comprehensive knowledge base of common issues',
      'Clear escalation procedures and contacts',
      'Access to customer account systems'
    ]
  },
  
  metadata: {
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    createdBy: 'voice-matrix-team',
    tags: ['support', 'customer-service', 'troubleshooting', 'triage', 'escalation'],
    usage: {
      timesUsed: 0,
      averageRating: 0,
      lastUsed: ''
    }
  },
  
  documentation: {
    description: 'An advanced customer support triage system that efficiently categorizes issues, provides immediate resolution for common problems, and escalates complex cases with complete context to appropriate specialists.',
    detailedInstructions: `This template implements a systematic approach to customer support that prioritizes rapid issue resolution while maintaining high customer satisfaction. The AI agent acts as a skilled first-line support representative with access to comprehensive troubleshooting knowledge.

**Setup Instructions:**
1. Customize company/support team branding
2. Input comprehensive common issues and solutions
3. Define clear escalation criteria and routing rules
4. Set business hours and response time expectations
5. Configure knowledge base and resource links
6. Test with various issue scenarios

**Optimization Tips:**
- Regularly update common issues database based on ticket trends
- Monitor escalation rates and refine first-line resolution capabilities
- Track customer satisfaction scores and adjust approach accordingly
- Implement feedback loops to continuously improve knowledge base`,
    bestPractices: [
      'Always acknowledge customer frustration with empathy',
      'Gather complete information before attempting solutions',
      'Document all troubleshooting steps for escalation context',
      'Provide clear next steps and expectations for every interaction',
      'Follow up to ensure resolution satisfaction'
    ],
    commonPitfalls: [
      'Rushing to solutions without understanding the complete issue',
      'Escalating too quickly without attempting basic troubleshooting',
      'Failing to collect account information for proper context',
      'Not setting clear expectations for escalated issues',
      'Missing opportunities to educate customers for future prevention'
    ],
    successStories: [
      {
        company: 'CloudTech Solutions',
        industry: 'SaaS',
        challenge: 'Support team overwhelmed with 200+ daily tickets, 3-hour average response time',
        solution: 'Deployed support triage assistant to handle initial contact and common issues',
        results: 'Reduced ticket volume by 65%, improved first-call resolution to 72%, cut response time to 45 minutes',
        metrics: {
          'ticket_volume_reduction': 65,
          'first_call_resolution': 72,
          'response_time_improvement': 75
        }
      }
    ]
  }
};

// Additional templates will be added in separate files for better organization
// - Appointment Booking Specialist
// - Sales Discovery Agent  
// - Customer Feedback Collector