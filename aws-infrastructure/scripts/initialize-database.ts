#!/usr/bin/env ts-node

/**
 * Database Initialization Script for Voice Matrix
 * Populates DynamoDB with strategic templates and initial data
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

// Import our strategic templates
import { STRATEGIC_TEMPLATES } from '../backend-lambda/src/templates/strategic-templates';
import { STRATEGIC_TEMPLATES_CONTINUED } from '../backend-lambda/src/templates/strategic-templates-continued';
import { EnhancedPromptTemplate } from '../backend-lambda/src/types/enhanced-templates';
import { PromptTemplatesTable, TemplateAnalyticsTable } from '../backend-lambda/src/database/dynamodb-schema';

// Configuration interface
interface InitConfig {
  environment: string;
  region: string;
  projectName: string;
  dryRun: boolean;
  verbose: boolean;
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class DatabaseInitializer {
  private docClient: DynamoDBDocumentClient;
  private config: InitConfig;
  private tableNames: {
    promptTemplates: string;
    userAssistants: string;
    callLogs: string;
    templateAnalytics: string;
    userSessions: string;
  };

  constructor(config: InitConfig) {
    this.config = config;
    
    // Initialize DynamoDB client
    const client = new DynamoDBClient({ 
      region: config.region,
      ...(config.verbose && {
        logger: {
          info: (message: any) => this.log('info', `DynamoDB: ${message}`),
          warn: (message: any) => this.log('warn', `DynamoDB: ${message}`),
          error: (message: any) => this.log('error', `DynamoDB: ${message}`)
        }
      })
    });
    
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false
      }
    });

    // Construct table names
    this.tableNames = {
      promptTemplates: `${config.projectName}-PromptTemplates-${config.environment}`,
      userAssistants: `${config.projectName}-UserAssistants-${config.environment}`,
      callLogs: `${config.projectName}-CallLogs-${config.environment}`,
      templateAnalytics: `${config.projectName}-TemplateAnalytics-${config.environment}`,
      userSessions: `${config.projectName}-UserSessions-${config.environment}`
    };
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}]`;
    
    switch (level) {
      case 'info':
        console.log(`${colors.blue}${prefix}${colors.reset} ${message}`);
        break;
      case 'warn':
        console.log(`${colors.yellow}${prefix} [WARN]${colors.reset} ${message}`);
        break;
      case 'error':
        console.log(`${colors.red}${prefix} [ERROR]${colors.reset} ${message}`);
        break;
      case 'success':
        console.log(`${colors.green}${prefix} [SUCCESS]${colors.reset} ${message}`);
        break;
    }
  }

  async initialize(): Promise<void> {
    this.log('info', 'Starting Voice Matrix Database Initialization');
    this.log('info', `Environment: ${this.config.environment}`);
    this.log('info', `Region: ${this.config.region}`);
    this.log('info', `Dry Run: ${this.config.dryRun}`);
    
    console.log(`${colors.cyan}Table Names:${colors.reset}`);
    Object.entries(this.tableNames).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('');

    try {
      // Step 1: Validate table existence
      await this.validateTables();

      // Step 2: Initialize strategic templates
      await this.initializeStrategicTemplates();

      // Step 3: Initialize template analytics
      await this.initializeTemplateAnalytics();

      // Step 4: Create sample user sessions (for dev environment only)
      if (this.config.environment === 'dev') {
        await this.createSampleUserSessions();
      }

      this.log('success', 'Database initialization completed successfully!');
      
    } catch (error) {
      this.log('error', `Database initialization failed: ${error.message}`);
      if (this.config.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  }

  private async validateTables(): Promise<void> {
    this.log('info', 'Validating table existence...');
    
    for (const [key, tableName] of Object.entries(this.tableNames)) {
      try {
        // Try to describe the table
        if (!this.config.dryRun) {
          const result = await this.docClient.send({
            TableName: tableName,
            Select: 'COUNT'
          } as any);
          this.log('info', `✓ Table ${tableName} exists`);
        } else {
          this.log('info', `[DRY RUN] Would validate table: ${tableName}`);
        }
      } catch (error) {
        throw new Error(`Table ${tableName} does not exist or is not accessible: ${error.message}`);
      }
    }
    
    this.log('success', 'All tables validated successfully');
  }

  private async initializeStrategicTemplates(): Promise<void> {
    this.log('info', 'Initializing strategic templates...');
    
    const allTemplates = [...STRATEGIC_TEMPLATES, ...STRATEGIC_TEMPLATES_CONTINUED];
    this.log('info', `Found ${allTemplates.length} strategic templates to initialize`);

    const templateRecords: PromptTemplatesTable[] = allTemplates.map(template => ({
      templateId: template.id,
      name: template.name,
      version: template.version,
      status: template.status,
      templateType: 'predefined',
      category: template.category.primary,
      industry: template.industry,
      complexity: template.complexity,
      templateData: JSON.stringify(template),
      usageCount: template.metadata.usage.timesUsed,
      averageRating: template.metadata.usage.averageRating,
      lastUsed: template.metadata.usage.lastUsed,
      createdAt: template.metadata.createdAt,
      updatedAt: template.metadata.updatedAt,
      createdBy: template.metadata.createdBy,
      tags: template.metadata.tags,
      keywords: this.generateKeywords(template),
      isLatestVersion: true,
      visibility: 'public'
    }));

    if (this.config.dryRun) {
      this.log('info', '[DRY RUN] Would insert the following templates:');
      templateRecords.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name} (${template.templateId})`);
        console.log(`     Category: ${template.category}, Industry: ${template.industry.join(', ')}`);
        console.log(`     Complexity: ${template.complexity}, Version: ${template.version}`);
      });
      return;
    }

    // Insert templates in batches
    const batchSize = 25; // DynamoDB batch write limit
    for (let i = 0; i < templateRecords.length; i += batchSize) {
      const batch = templateRecords.slice(i, i + batchSize);
      
      try {
        const putRequests = batch.map(template => ({
          PutRequest: {
            Item: template
          }
        }));

        await this.docClient.send(new BatchWriteCommand({
          RequestItems: {
            [this.tableNames.promptTemplates]: putRequests
          }
        }));

        this.log('info', `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(templateRecords.length / batchSize)} (${batch.length} templates)`);
        
        // Add small delay to avoid throttling
        if (i + batchSize < templateRecords.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
          this.log('warn', `Some templates in batch ${Math.floor(i / batchSize) + 1} already exist, skipping...`);
        } else {
          throw error;
        }
      }
    }

    this.log('success', `Successfully initialized ${templateRecords.length} strategic templates`);
  }

  private async initializeTemplateAnalytics(): Promise<void> {
    this.log('info', 'Initializing template analytics...');
    
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const allTemplates = [...STRATEGIC_TEMPLATES, ...STRATEGIC_TEMPLATES_CONTINUED];

    const analyticsRecords: TemplateAnalyticsTable[] = allTemplates.map(template => ({
      analyticsId: `${template.id}#${currentMonth}`,
      templateId: template.id,
      period: currentMonth,
      periodType: 'monthly',
      totalUsages: template.metadata.usage.timesUsed,
      activeAssistants: Math.floor(template.metadata.usage.timesUsed * 0.3), // Estimate
      totalCalls: template.metadata.usage.timesUsed * 15, // Estimate 15 calls per usage
      successfulCalls: Math.floor(template.metadata.usage.timesUsed * 15 * 0.85), // 85% success rate
      averageCallDuration: template.useCase.avgCallDuration,
      averageSuccessRate: template.useCase.successRate / 100,
      averageCustomerSatisfaction: template.metadata.usage.averageRating,
      averageCallQuality: template.metadata.usage.averageRating,
      objectivesAchieved: template.businessObjectives.reduce((acc, obj) => {
        acc[obj.name.toLowerCase().replace(/\s+/g, '_')] = Math.floor(Math.random() * 50) + 10;
        return acc;
      }, {} as Record<string, number>),
      conversionRates: template.businessObjectives.reduce((acc, obj) => {
        acc[obj.name.toLowerCase().replace(/\s+/g, '_')] = Math.random() * 0.3 + 0.6; // 60-90%
        return acc;
      }, {} as Record<string, number>),
      uniqueUsers: Math.floor(template.metadata.usage.timesUsed * 0.7),
      newUsers: Math.floor(template.metadata.usage.timesUsed * 0.4),
      returningUsers: Math.floor(template.metadata.usage.timesUsed * 0.3),
      totalRatings: Math.floor(template.metadata.usage.timesUsed * 0.6),
      averageRating: template.metadata.usage.averageRating,
      ratingDistribution: this.generateRatingDistribution(template.metadata.usage.averageRating),
      industryBreakdown: template.industry.reduce((acc, ind) => {
        acc[ind] = Math.floor(template.metadata.usage.timesUsed / template.industry.length);
        return acc;
      }, {} as Record<string, number>),
      complexityAdoption: { [template.complexity]: template.metadata.usage.timesUsed },
      growthRate: Math.random() * 0.4 - 0.1, // -10% to +30%
      trendDirection: template.metadata.usage.averageRating > 4 ? 'up' : template.metadata.usage.averageRating > 3 ? 'stable' : 'down',
      popularityScore: template.metadata.usage.timesUsed * template.metadata.usage.averageRating,
      recommendationScore: template.metadata.usage.averageRating * template.useCase.successRate / 100,
      computedAt: new Date().toISOString(),
      dataVersion: '1.0.0'
    }));

    if (this.config.dryRun) {
      this.log('info', '[DRY RUN] Would insert analytics for:');
      analyticsRecords.forEach((analytics, index) => {
        console.log(`  ${index + 1}. ${analytics.templateId} - ${analytics.period} (${analytics.totalUsages} usages)`);
      });
      return;
    }

    // Insert analytics in batches
    const batchSize = 25;
    for (let i = 0; i < analyticsRecords.length; i += batchSize) {
      const batch = analyticsRecords.slice(i, i + batchSize);
      
      const putRequests = batch.map(analytics => ({
        PutRequest: {
          Item: analytics
        }
      }));

      await this.docClient.send(new BatchWriteCommand({
        RequestItems: {
          [this.tableNames.templateAnalytics]: putRequests
        }
      }));

      this.log('info', `Inserted analytics batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(analyticsRecords.length / batchSize)}`);
    }

    this.log('success', `Successfully initialized analytics for ${analyticsRecords.length} templates`);
  }

  private async createSampleUserSessions(): Promise<void> {
    this.log('info', 'Creating sample user sessions for dev environment...');
    
    if (this.config.dryRun) {
      this.log('info', '[DRY RUN] Would create 5 sample user sessions');
      return;
    }

    const sampleSessions = Array.from({ length: 5 }, (_, index) => ({
      sessionId: `session-dev-${Date.now()}-${index}`,
      userId: `user-dev-${index + 1}`,
      userEmail: `dev-user-${index + 1}@voicematrix.dev`,
      startTime: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: index < 2, // First 2 sessions are active
      actionsPerformed: ['template_viewed', 'assistant_created', 'assistant_deployed'],
      templatesViewed: STRATEGIC_TEMPLATES.slice(0, 3).map(t => t.id),
      assistantsAccessed: [`assistant-dev-${index + 1}`],
      events: JSON.stringify([
        { type: 'login', timestamp: new Date().toISOString() },
        { type: 'template_browse', timestamp: new Date().toISOString() }
      ]),
      userAgent: 'Mozilla/5.0 (Development Environment)',
      responseTime: 150 + Math.random() * 100,
      errorCount: Math.floor(Math.random() * 3),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }));

    for (const session of sampleSessions) {
      await this.docClient.send(new PutCommand({
        TableName: this.tableNames.userSessions,
        Item: session
      }));
    }

    this.log('success', `Created ${sampleSessions.length} sample user sessions`);
  }

  private generateKeywords(template: EnhancedPromptTemplate): string {
    const keywords = [
      template.name,
      template.category.primary,
      ...template.industry,
      template.complexity,
      ...template.metadata.tags,
      ...template.businessObjectives.map(obj => obj.name),
      template.useCase.title
    ];

    return keywords.join(' ').toLowerCase();
  }

  private generateRatingDistribution(averageRating: number): number[] {
    // Generate a realistic rating distribution based on average
    const total = 100;
    const distribution = [0, 0, 0, 0, 0]; // 1-5 stars
    
    if (averageRating >= 4.5) {
      distribution[4] = 70; // 5 stars
      distribution[3] = 25; // 4 stars
      distribution[2] = 5;  // 3 stars
    } else if (averageRating >= 4.0) {
      distribution[4] = 50;
      distribution[3] = 40;
      distribution[2] = 10;
    } else if (averageRating >= 3.5) {
      distribution[4] = 30;
      distribution[3] = 50;
      distribution[2] = 15;
      distribution[1] = 5;
    } else {
      distribution[4] = 20;
      distribution[3] = 30;
      distribution[2] = 30;
      distribution[1] = 15;
      distribution[0] = 5;
    }

    return distribution;
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const config: InitConfig = {
    environment: 'dev',
    region: 'us-east-1',
    projectName: 'VoiceMatrix',
    dryRun: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-e':
      case '--environment':
        config.environment = args[++i];
        break;
      case '-r':
      case '--region':
        config.region = args[++i];
        break;
      case '-p':
      case '--project':
        config.projectName = args[++i];
        break;
      case '-d':
      case '--dry-run':
        config.dryRun = true;
        break;
      case '-v':
      case '--verbose':
        config.verbose = true;
        break;
      case '-h':
      case '--help':
        console.log(`
Voice Matrix Database Initialization Tool

Usage: ts-node initialize-database.ts [OPTIONS]

Options:
  -e, --environment ENV    Environment (dev|staging|prod) [default: dev]
  -r, --region REGION      AWS region [default: us-east-1]
  -p, --project NAME       Project name [default: VoiceMatrix]
  -d, --dry-run           Show what would be done without executing
  -v, --verbose           Enable verbose logging
  -h, --help              Show this help message

Examples:
  ts-node initialize-database.ts -e dev
  ts-node initialize-database.ts -e prod -r us-west-2 --dry-run
        `);
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  // Load environment file if it exists
  const envFile = join(__dirname, `../.env.${config.environment}`);
  if (existsSync(envFile)) {
    config({ path: envFile });
    console.log(`${colors.cyan}Loaded environment file: ${envFile}${colors.reset}`);
  }

  // Validate environment
  if (!['dev', 'staging', 'prod'].includes(config.environment)) {
    console.error(`${colors.red}Invalid environment: ${config.environment}${colors.reset}`);
    process.exit(1);
  }

  const initializer = new DatabaseInitializer(config);
  await initializer.initialize();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

export { DatabaseInitializer };