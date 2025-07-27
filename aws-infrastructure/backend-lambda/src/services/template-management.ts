/**
 * Template Management Service for Voice Matrix
 * High-level API for managing enhanced prompt templates
 */

import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  EnhancedPromptTemplate, 
  TemplateCreationRequest,
  TemplateValidationResult,
  ValidationError,
  ValidationWarning,
  OptimizationSuggestion,
  Industry,
  TemplateComplexity,
  ConversationObjective,
  BusinessContextInput
} from '../types/enhanced-templates';
import { 
  PromptTemplatesTable, 
  DatabaseAccessLayer 
} from '../database/dynamodb-schema';
import { 
  TemplateVersioningService, 
  VersionCreateRequest,
  createTemplateVersioningService 
} from './template-versioning';

export interface TemplateSearchFilters {
  industry?: Industry[];
  category?: string[];
  complexity?: TemplateComplexity[];
  status?: ('active' | 'beta' | 'deprecated' | 'draft')[];
  tags?: string[];
  createdBy?: string;
  usageCountMin?: number;
  averageRatingMin?: number;
}

export interface TemplateSearchResult {
  templates: PromptTemplatesTable[];
  total: number;
  page: number;
  limit: number;
  filters: TemplateSearchFilters;
}

export interface TemplateCloneRequest {
  sourceTemplateId: string;
  newName: string;
  userId: string;
  customizations?: {
    [segmentId: string]: string;
  };
  businessContext?: BusinessContextInput;
}

export interface TemplateAnalytics {
  templateId: string;
  usageStats: {
    totalUsages: number;
    activeInstances: number;
    successRate: number;
    averageRating: number;
  };
  performanceMetrics: {
    averageSetupTime: number;
    userSatisfactionScore: number;
    conversionRate: number;
  };
  trendData: {
    usageGrowth: number;
    ratingTrend: number;
    popularityRank: number;
  };
}

export class TemplateManagementService implements DatabaseAccessLayer {
  private versioningService: TemplateVersioningService;

  constructor(
    private docClient: DynamoDBDocumentClient,
    private templatesTable: string,
    private analyticsTable: string
  ) {
    this.versioningService = createTemplateVersioningService(docClient, templatesTable);
  }

  // Template CRUD Operations

  /**
   * Creates a new template
   */
  async createTemplate(templateData: EnhancedPromptTemplate, userId: string): Promise<PromptTemplatesTable> {
    // Validate template
    const validation = await this.validateTemplate(templateData);
    if (!validation.isValid) {
      const criticalErrors = validation.errors.filter(e => e.severity === 'critical');
      if (criticalErrors.length > 0) {
        throw new Error(`Template validation failed: ${criticalErrors.map(e => e.message).join(', ')}`);
      }
    }

    // Generate template ID
    const templateId = `template-${uuidv4()}`;
    
    // Create template record
    const templateRecord: PromptTemplatesTable = {
      templateId,
      name: templateData.name,
      version: templateData.version || '1.0.0',
      status: templateData.status || 'draft',
      templateType: 'custom',
      category: templateData.category.primary,
      industry: templateData.industry,
      complexity: templateData.complexity,
      templateData: JSON.stringify(templateData),
      usageCount: 0,
      averageRating: 0,
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      tags: templateData.metadata.tags || [],
      keywords: this.generateKeywords(templateData),
      isLatestVersion: true,
      visibility: 'private',
      versionHistory: JSON.stringify([])
    };

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.templatesTable,
        Item: templateRecord,
        ConditionExpression: 'attribute_not_exists(templateId)'
      }));

      return templateRecord;
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Gets a template by ID
   */
  async getTemplate(templateId: string): Promise<PromptTemplatesTable> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.templatesTable,
        Key: { templateId }
      }));

      if (!result.Item) {
        throw new Error(`Template ${templateId} not found`);
      }

      return result.Item as PromptTemplatesTable;
    } catch (error) {
      console.error('Error getting template:', error);
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * Gets all active templates
   */
  async getActiveTemplates(): Promise<PromptTemplatesTable[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.templatesTable,
        IndexName: 'Status-UpdatedAt-Index',
        KeyConditionExpression: '#status = :status',
        FilterExpression: 'isLatestVersion = :true',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'active',
          ':true': true
        },
        ScanIndexForward: false
      }));

      return result.Items as PromptTemplatesTable[] || [];
    } catch (error) {
      console.error('Error getting active templates:', error);
      throw new Error(`Failed to get active templates: ${error.message}`);
    }
  }

  /**
   * Gets templates by category
   */
  async getTemplatesByCategory(category: string): Promise<PromptTemplatesTable[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.templatesTable,
        IndexName: 'Category-CreatedAt-Index',
        KeyConditionExpression: 'category = :category',
        FilterExpression: 'isLatestVersion = :true AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':category': category,
          ':true': true,
          ':status': 'active'
        },
        ScanIndexForward: false
      }));

      return result.Items as PromptTemplatesTable[] || [];
    } catch (error) {
      console.error('Error getting templates by category:', error);
      throw new Error(`Failed to get templates by category: ${error.message}`);
    }
  }

  /**
   * Gets templates by industry
   */
  async getTemplatesByIndustry(industry: string): Promise<PromptTemplatesTable[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.templatesTable,
        IndexName: 'Industry-UsageCount-Index',
        KeyConditionExpression: 'industry = :industry',
        FilterExpression: 'isLatestVersion = :true AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':industry': industry,
          ':true': true,
          ':status': 'active'
        },
        ScanIndexForward: false
      }));

      return result.Items as PromptTemplatesTable[] || [];
    } catch (error) {
      console.error('Error getting templates by industry:', error);
      throw new Error(`Failed to get templates by industry: ${error.message}`);
    }
  }

  /**
   * Updates a template
   */
  async updateTemplate(templateId: string, updates: Partial<PromptTemplatesTable>): Promise<void> {
    try {
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.entries(updates).forEach(([key, value], index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        
        updateExpression.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      });

      // Always update the updatedAt timestamp
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await this.docClient.send(new UpdateCommand({
        TableName: this.templatesTable,
        Key: { templateId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(templateId)'
      }));
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Advanced template search with filters
   */
  async searchTemplates(
    filters: TemplateSearchFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<TemplateSearchResult> {
    try {
      let filterExpression = 'isLatestVersion = :true';
      const expressionAttributeValues: any = { ':true': true };
      const expressionAttributeNames: any = {};

      // Build filter expressions
      if (filters.status && filters.status.length > 0) {
        filterExpression += ' AND #status IN (:status0';
        expressionAttributeNames['#status'] = 'status';
        filters.status.forEach((status, index) => {
          if (index === 0) {
            expressionAttributeValues[':status0'] = status;
          } else {
            filterExpression += `, :status${index}`;
            expressionAttributeValues[`:status${index}`] = status;
          }
        });
        filterExpression += ')';
      }

      if (filters.complexity && filters.complexity.length > 0) {
        filterExpression += ' AND complexity IN (:complexity0';
        filters.complexity.forEach((complexity, index) => {
          if (index === 0) {
            expressionAttributeValues[':complexity0'] = complexity;
          } else {
            filterExpression += `, :complexity${index}`;
            expressionAttributeValues[`:complexity${index}`] = complexity;
          }
        });
        filterExpression += ')';
      }

      if (filters.usageCountMin !== undefined) {
        filterExpression += ' AND usageCount >= :usageCountMin';
        expressionAttributeValues[':usageCountMin'] = filters.usageCountMin;
      }

      if (filters.averageRatingMin !== undefined) {
        filterExpression += ' AND averageRating >= :averageRatingMin';
        expressionAttributeValues[':averageRatingMin'] = filters.averageRatingMin;
      }

      if (filters.createdBy) {
        filterExpression += ' AND createdBy = :createdBy';
        expressionAttributeValues[':createdBy'] = filters.createdBy;
      }

      // Use scan for complex filtering (in production, consider using search indexes)
      const result = await this.docClient.send(new ScanCommand({
        TableName: this.templatesTable,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      const allItems = result.Items as PromptTemplatesTable[] || [];
      
      // Apply additional filters that require complex logic
      let filteredItems = allItems;

      if (filters.industry && filters.industry.length > 0) {
        filteredItems = filteredItems.filter(item => 
          item.industry.some(ind => filters.industry!.includes(ind as Industry))
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        filteredItems = filteredItems.filter(item =>
          item.tags.some(tag => filters.tags!.includes(tag))
        );
      }

      // Sort by usage count and rating
      filteredItems.sort((a, b) => {
        const scoreA = (a.usageCount * 0.7) + (a.averageRating * 0.3);
        const scoreB = (b.usageCount * 0.7) + (b.averageRating * 0.3);
        return scoreB - scoreA;
      });

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedItems = filteredItems.slice(startIndex, endIndex);

      return {
        templates: paginatedItems,
        total: filteredItems.length,
        page,
        limit,
        filters
      };
    } catch (error) {
      console.error('Error searching templates:', error);
      throw new Error(`Failed to search templates: ${error.message}`);
    }
  }

  /**
   * Clones an existing template
   */
  async cloneTemplate(request: TemplateCloneRequest): Promise<PromptTemplatesTable> {
    // Get source template
    const sourceTemplate = await this.getTemplate(request.sourceTemplateId);
    const sourceData = JSON.parse(sourceTemplate.templateData) as EnhancedPromptTemplate;

    // Create cloned template data
    const clonedData: EnhancedPromptTemplate = {
      ...sourceData,
      id: `template-${uuidv4()}`,
      name: request.newName,
      version: '1.0.0',
      status: 'draft',
      metadata: {
        ...sourceData.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: request.userId,
        parentTemplateId: request.sourceTemplateId
      }
    };

    // Apply customizations if provided
    if (request.customizations) {
      clonedData.segments = clonedData.segments.map(segment => {
        if (request.customizations![segment.id]) {
          return {
            ...segment,
            content: request.customizations![segment.id]
          };
        }
        return segment;
      });
    }

    // Update business context if provided
    if (request.businessContext) {
      clonedData.industry = [request.businessContext.industry];
      clonedData.businessObjectives = [{
        id: uuidv4(),
        name: request.businessContext.primaryObjective,
        description: `Primary objective: ${request.businessContext.primaryObjective}`,
        successCriteria: [],
        priority: 'high',
        measurable: true
      }];
    }

    return await this.createTemplate(clonedData, request.userId);
  }

  /**
   * Validates a template
   */
  async validateTemplate(template: EnhancedPromptTemplate): Promise<TemplateValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: OptimizationSuggestion[] = [];

    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Template name is required',
        severity: 'critical',
        suggestedFix: 'Provide a descriptive name for the template'
      });
    }

    if (!template.segments || template.segments.length === 0) {
      errors.push({
        field: 'segments',
        message: 'Template must have at least one segment',
        severity: 'critical',
        suggestedFix: 'Add prompt segments to define the template structure'
      });
    }

    // Segment validation
    if (template.segments) {
      const dynamicSegments = template.segments.filter(s => s.type === 'dynamic');
      if (dynamicSegments.length === 0) {
        warnings.push({
          field: 'segments',
          message: 'Template has no dynamic segments',
          recommendation: 'Consider adding dynamic segments for customization',
          impact: 'user_experience'
        });
      }

      // Check for required segments without content
      template.segments.forEach(segment => {
        if (segment.validation?.type === 'required' && !segment.content) {
          errors.push({
            field: `segments.${segment.id}`,
            message: `Required segment '${segment.label}' has no content`,
            severity: 'major',
            suggestedFix: 'Provide default content or make segment optional'
          });
        }
      });
    }

    // Business context validation
    if (!template.businessObjectives || template.businessObjectives.length === 0) {
      warnings.push({
        field: 'businessObjectives',
        message: 'No business objectives defined',
        recommendation: 'Define clear business objectives for better template effectiveness',
        impact: 'business_outcome'
      });
    }

    // VAPI configuration validation
    if (!template.vapiConfiguration) {
      errors.push({
        field: 'vapiConfiguration',
        message: 'VAPI configuration is required',
        severity: 'critical',
        suggestedFix: 'Configure VAPI settings for voice integration'
      });
    } else {
      if (!template.vapiConfiguration.voice.voiceId) {
        errors.push({
          field: 'vapiConfiguration.voice.voiceId',
          message: 'Voice ID is required',
          severity: 'major',
          suggestedFix: 'Select a voice for the assistant'
        });
      }
    }

    // Suggestions for optimization
    if (template.segments && template.segments.length > 10) {
      suggestions.push({
        type: 'user_experience',
        description: 'Template has many segments which may overwhelm users',
        expectedImpact: 'medium',
        implementationEffort: 'medium',
        action: 'Consider grouping related segments or simplifying the template'
      });
    }

    if (!template.documentation?.bestPractices || template.documentation.bestPractices.length === 0) {
      suggestions.push({
        type: 'user_experience',
        description: 'Add best practices documentation',
        expectedImpact: 'high',
        implementationEffort: 'low',
        action: 'Document best practices for using this template effectively'
      });
    }

    // Calculate scores
    const completenessScore = this.calculateCompletenessScore(template);
    const clarityScore = this.calculateClarityScore(template);
    const businessAlignmentScore = this.calculateBusinessAlignmentScore(template);
    const technicalQualityScore = this.calculateTechnicalQualityScore(template);

    const overallScore = (completenessScore + clarityScore + businessAlignmentScore + technicalQualityScore) / 4;

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      suggestions,
      score: {
        overall: Math.round(overallScore * 100) / 100,
        categories: {
          completeness: Math.round(completenessScore * 100) / 100,
          clarity: Math.round(clarityScore * 100) / 100,
          businessAlignment: Math.round(businessAlignmentScore * 100) / 100,
          technicalQuality: Math.round(technicalQualityScore * 100) / 100
        }
      }
    };
  }

  /**
   * Gets template analytics
   */
  async getTemplateAnalytics(templateId: string): Promise<TemplateAnalytics> {
    // This would typically query the analytics table
    // For now, returning mock data structure
    return {
      templateId,
      usageStats: {
        totalUsages: 0,
        activeInstances: 0,
        successRate: 0,
        averageRating: 0
      },
      performanceMetrics: {
        averageSetupTime: 0,
        userSatisfactionScore: 0,
        conversionRate: 0
      },
      trendData: {
        usageGrowth: 0,
        ratingTrend: 0,
        popularityRank: 0
      }
    };
  }

  /**
   * Gets popular templates
   */
  async getPopularTemplates(limit: number = 10): Promise<PromptTemplatesTable[]> {
    try {
      const result = await this.docClient.send(new ScanCommand({
        TableName: this.templatesTable,
        FilterExpression: 'isLatestVersion = :true AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':true': true,
          ':status': 'active'
        }
      }));

      const templates = result.Items as PromptTemplatesTable[] || [];
      
      // Sort by usage count and rating
      return templates
        .sort((a, b) => {
          const scoreA = (a.usageCount * 0.6) + (a.averageRating * 0.4);
          const scoreB = (b.usageCount * 0.6) + (b.averageRating * 0.4);
          return scoreB - scoreA;
        })
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting popular templates:', error);
      throw new Error(`Failed to get popular templates: ${error.message}`);
    }
  }

  // Placeholder implementations for DatabaseAccessLayer interface
  async getAssistant(assistantId: string): Promise<any> { throw new Error('Not implemented'); }
  async getUserAssistants(userId: string): Promise<any[]> { throw new Error('Not implemented'); }
  async getAssistantsByStatus(status: string): Promise<any[]> { throw new Error('Not implemented'); }
  async createAssistant(assistant: any): Promise<void> { throw new Error('Not implemented'); }
  async updateAssistant(assistantId: string, updates: any): Promise<void> { throw new Error('Not implemented'); }
  async deleteAssistant(assistantId: string): Promise<void> { throw new Error('Not implemented'); }
  async getCallLog(callId: string): Promise<any> { throw new Error('Not implemented'); }
  async getCallsByAssistant(assistantId: string, limit?: number): Promise<any[]> { throw new Error('Not implemented'); }
  async getCallsByUser(userId: string, startDate?: string, endDate?: string): Promise<any[]> { throw new Error('Not implemented'); }
  async createCallLog(callLog: any): Promise<void> { throw new Error('Not implemented'); }
  async updateCallLog(callId: string, updates: any): Promise<void> { throw new Error('Not implemented'); }
  async updateTemplateAnalytics(analytics: any): Promise<void> { throw new Error('Not implemented'); }
  async getSession(sessionId: string): Promise<any> { throw new Error('Not implemented'); }
  async getUserSessions(userId: string): Promise<any[]> { throw new Error('Not implemented'); }
  async createSession(session: any): Promise<void> { throw new Error('Not implemented'); }
  async updateSession(sessionId: string, updates: any): Promise<void> { throw new Error('Not implemented'); }

  // Private helper methods

  private generateKeywords(template: EnhancedPromptTemplate): string {
    const keywords = [
      template.name,
      template.category.primary,
      ...template.industry,
      template.complexity,
      ...template.metadata.tags,
      ...template.businessObjectives.map(obj => obj.name)
    ];

    return keywords.join(' ').toLowerCase();
  }

  private calculateCompletenessScore(template: EnhancedPromptTemplate): number {
    let score = 0;
    const maxScore = 10;

    if (template.name) score += 1;
    if (template.segments && template.segments.length > 0) score += 2;
    if (template.businessObjectives && template.businessObjectives.length > 0) score += 2;
    if (template.vapiConfiguration) score += 2;
    if (template.documentation?.description) score += 1;
    if (template.documentation?.bestPractices && template.documentation.bestPractices.length > 0) score += 1;
    if (template.performanceConfig) score += 1;

    return score / maxScore;
  }

  private calculateClarityScore(template: EnhancedPromptTemplate): number {
    let score = 0;
    const maxScore = 8;

    if (template.documentation?.description && template.documentation.description.length > 50) score += 2;
    if (template.documentation?.detailedInstructions) score += 2;
    if (template.segments.every(s => s.label && s.businessPurpose)) score += 2;
    if (template.useCase?.description) score += 1;
    if (template.documentation?.bestPractices && template.documentation.bestPractices.length > 0) score += 1;

    return score / maxScore;
  }

  private calculateBusinessAlignmentScore(template: EnhancedPromptTemplate): number {
    let score = 0;
    const maxScore = 6;

    if (template.businessObjectives && template.businessObjectives.length > 0) score += 2;
    if (template.useCase?.expectedOutcomes && template.useCase.expectedOutcomes.length > 0) score += 2;
    if (template.performanceConfig?.kpis) score += 1;
    if (template.category.functionalArea) score += 1;

    return score / maxScore;
  }

  private calculateTechnicalQualityScore(template: EnhancedPromptTemplate): number {
    let score = 0;
    const maxScore = 8;

    if (template.vapiConfiguration?.model) score += 2;
    if (template.vapiConfiguration?.voice) score += 2;
    if (template.vapiConfiguration?.conversationSettings) score += 2;
    if (template.segments.some(s => s.validation)) score += 1;
    if (template.vapiConfiguration?.businessRules?.escalationTriggers) score += 1;

    return score / maxScore;
  }
}

/**
 * Factory function to create template management service
 */
export function createTemplateManagementService(
  docClient: DynamoDBDocumentClient,
  templatesTable: string,
  analyticsTable: string
): TemplateManagementService {
  return new TemplateManagementService(docClient, templatesTable, analyticsTable);
}