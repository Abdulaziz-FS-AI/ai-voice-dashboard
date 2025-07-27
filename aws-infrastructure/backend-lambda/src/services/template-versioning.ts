/**
 * Template Versioning System for Voice Matrix
 * Handles template version creation, tracking, and management
 */

import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedPromptTemplate, TemplateValidationResult } from '../types/enhanced-templates';
import { PromptTemplatesTable } from '../database/dynamodb-schema';

export interface VersionChange {
  timestamp: string;
  userId: string;
  changeType: 'major' | 'minor' | 'patch';
  changes: FieldChange[];
  reason: string;
  rollbackPoint: boolean;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  impact: 'breaking' | 'enhancement' | 'bugfix' | 'cosmetic';
}

export interface VersionCreateRequest {
  templateId: string;
  changes: FieldChange[];
  changeType: 'major' | 'minor' | 'patch';
  reason: string;
  userId: string;
  markAsRollbackPoint?: boolean;
}

export interface VersionRollbackRequest {
  templateId: string;
  targetVersion: string;
  userId: string;
  reason: string;
}

export class TemplateVersioningService {
  constructor(
    private docClient: DynamoDBDocumentClient,
    private templatesTable: string
  ) {}

  /**
   * Creates a new version of an existing template
   */
  async createVersion(request: VersionCreateRequest): Promise<{
    newVersion: string;
    template: PromptTemplatesTable;
  }> {
    // Get current template
    const currentTemplate = await this.getCurrentTemplate(request.templateId);
    if (!currentTemplate) {
      throw new Error(`Template ${request.templateId} not found`);
    }

    // Calculate new version number
    const newVersion = this.calculateNextVersion(currentTemplate.version, request.changeType);
    
    // Create version change record
    const versionChange: VersionChange = {
      timestamp: new Date().toISOString(),
      userId: request.userId,
      changeType: request.changeType,
      changes: request.changes,
      reason: request.reason,
      rollbackPoint: request.markAsRollbackPoint || false
    };

    // Update version history
    const currentHistory = this.parseVersionHistory(currentTemplate.versionHistory);
    const updatedHistory = [...currentHistory, versionChange];

    // Create new template version record
    const newTemplateRecord: PromptTemplatesTable = {
      ...currentTemplate,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      isLatestVersion: true,
      versionHistory: JSON.stringify(updatedHistory)
    };

    // Apply the changes to template data
    const templateData = JSON.parse(currentTemplate.templateData) as EnhancedPromptTemplate;
    const updatedTemplateData = this.applyChangesToTemplate(templateData, request.changes);
    newTemplateRecord.templateData = JSON.stringify(updatedTemplateData);

    try {
      // Transaction: Create new version and mark old version as not latest
      await this.docClient.send(new TransactWriteCommand({
        TransactItems: [
          // Update old version to not be latest
          {
            Update: {
              TableName: this.templatesTable,
              Key: { templateId: request.templateId },
              UpdateExpression: 'SET isLatestVersion = :false',
              ExpressionAttributeValues: {
                ':false': false
              },
              ConditionExpression: 'attribute_exists(templateId)'
            }
          },
          // Create new version record
          {
            Put: {
              TableName: this.templatesTable,
              Item: newTemplateRecord,
              ConditionExpression: 'attribute_not_exists(templateId)'
            }
          }
        ]
      }));

      return {
        newVersion,
        template: newTemplateRecord
      };
    } catch (error) {
      console.error('Error creating template version:', error);
      throw new Error(`Failed to create template version: ${error.message}`);
    }
  }

  /**
   * Rolls back a template to a previous version
   */
  async rollbackToVersion(request: VersionRollbackRequest): Promise<PromptTemplatesTable> {
    // Get target version
    const targetTemplate = await this.getTemplateVersion(request.templateId, request.targetVersion);
    if (!targetTemplate) {
      throw new Error(`Template version ${request.templateId}@${request.targetVersion} not found`);
    }

    // Get current template for version history
    const currentTemplate = await this.getCurrentTemplate(request.templateId);
    if (!currentTemplate) {
      throw new Error(`Current template ${request.templateId} not found`);
    }

    // Create rollback version change record
    const rollbackChange: VersionChange = {
      timestamp: new Date().toISOString(),
      userId: request.userId,
      changeType: 'major', // Rollbacks are considered major changes
      changes: [{
        field: 'rollback',
        oldValue: currentTemplate.version,
        newValue: request.targetVersion,
        impact: 'breaking'
      }],
      reason: `Rollback to version ${request.targetVersion}: ${request.reason}`,
      rollbackPoint: true
    };

    // Calculate new version (rollback creates a new version)
    const newVersion = this.calculateNextVersion(currentTemplate.version, 'major');
    
    // Update version history
    const currentHistory = this.parseVersionHistory(currentTemplate.versionHistory);
    const updatedHistory = [...currentHistory, rollbackChange];

    // Create new template record based on target version
    const rolledBackTemplate: PromptTemplatesTable = {
      ...targetTemplate,
      templateId: request.templateId, // Keep same ID
      version: newVersion, // New version number
      updatedAt: new Date().toISOString(),
      isLatestVersion: true,
      versionHistory: JSON.stringify(updatedHistory),
      parentTemplateId: targetTemplate.templateId // Reference to rolled back version
    };

    try {
      // Transaction: Update current version and create rollback version
      await this.docClient.send(new TransactWriteCommand({
        TransactItems: [
          // Mark current version as not latest
          {
            Update: {
              TableName: this.templatesTable,
              Key: { templateId: request.templateId },
              UpdateExpression: 'SET isLatestVersion = :false',
              ExpressionAttributeValues: {
                ':false': false
              }
            }
          },
          // Create rollback version
          {
            Put: {
              TableName: this.templatesTable,
              Item: rolledBackTemplate
            }
          }
        ]
      }));

      return rolledBackTemplate;
    } catch (error) {
      console.error('Error rolling back template:', error);
      throw new Error(`Failed to rollback template: ${error.message}`);
    }
  }

  /**
   * Gets version history for a template
   */
  async getVersionHistory(templateId: string): Promise<VersionChange[]> {
    const template = await this.getCurrentTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.parseVersionHistory(template.versionHistory);
  }

  /**
   * Gets all versions of a template
   */
  async getAllVersions(templateId: string): Promise<PromptTemplatesTable[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.templatesTable,
        KeyConditionExpression: 'templateId = :templateId',
        ExpressionAttributeValues: {
          ':templateId': templateId
        },
        ScanIndexForward: false // Most recent first
      }));

      return result.Items as PromptTemplatesTable[] || [];
    } catch (error) {
      console.error('Error getting template versions:', error);
      throw new Error(`Failed to get template versions: ${error.message}`);
    }
  }

  /**
   * Gets a specific version of a template
   */
  async getTemplateVersion(templateId: string, version: string): Promise<PromptTemplatesTable | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.templatesTable,
        Key: { 
          templateId: `${templateId}@${version}` // Versioned key format
        }
      }));

      return result.Item as PromptTemplatesTable || null;
    } catch (error) {
      console.error('Error getting specific template version:', error);
      return null;
    }
  }

  /**
   * Compares two template versions
   */
  async compareVersions(templateId: string, version1: string, version2: string): Promise<{
    differences: FieldChange[];
    summary: {
      breaking: number;
      enhancements: number;
      bugfixes: number;
      cosmetic: number;
    };
  }> {
    const [template1, template2] = await Promise.all([
      this.getTemplateVersion(templateId, version1),
      this.getTemplateVersion(templateId, version2)
    ]);

    if (!template1 || !template2) {
      throw new Error('One or both template versions not found');
    }

    const differences = this.calculateDifferences(template1, template2);
    const summary = this.summarizeDifferences(differences);

    return { differences, summary };
  }

  /**
   * Creates a rollback point for the current version
   */
  async createRollbackPoint(templateId: string, userId: string, reason: string): Promise<void> {
    const template = await this.getCurrentTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const rollbackPoint: VersionChange = {
      timestamp: new Date().toISOString(),
      userId,
      changeType: 'patch',
      changes: [],
      reason: `Rollback point created: ${reason}`,
      rollbackPoint: true
    };

    const currentHistory = this.parseVersionHistory(template.versionHistory);
    const updatedHistory = [...currentHistory, rollbackPoint];

    await this.docClient.send(new UpdateCommand({
      TableName: this.templatesTable,
      Key: { templateId },
      UpdateExpression: 'SET versionHistory = :history, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':history': JSON.stringify(updatedHistory),
        ':updatedAt': new Date().toISOString()
      }
    }));
  }

  /**
   * Gets rollback points for a template
   */
  async getRollbackPoints(templateId: string): Promise<VersionChange[]> {
    const history = await this.getVersionHistory(templateId);
    return history.filter(change => change.rollbackPoint);
  }

  // Private helper methods

  private async getCurrentTemplate(templateId: string): Promise<PromptTemplatesTable | null> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.templatesTable,
        IndexName: 'Status-UpdatedAt-Index',
        KeyConditionExpression: '#status = :status AND templateId = :templateId',
        FilterExpression: 'isLatestVersion = :true',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'active',
          ':templateId': templateId,
          ':true': true
        },
        Limit: 1
      }));

      return result.Items?.[0] as PromptTemplatesTable || null;
    } catch (error) {
      console.error('Error getting current template:', error);
      return null;
    }
  }

  private calculateNextVersion(currentVersion: string, changeType: 'major' | 'minor' | 'patch'): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        throw new Error(`Invalid change type: ${changeType}`);
    }
  }

  private parseVersionHistory(versionHistory?: string): VersionChange[] {
    if (!versionHistory) return [];
    try {
      return JSON.parse(versionHistory);
    } catch (error) {
      console.error('Error parsing version history:', error);
      return [];
    }
  }

  private applyChangesToTemplate(template: EnhancedPromptTemplate, changes: FieldChange[]): EnhancedPromptTemplate {
    const updatedTemplate = { ...template };

    for (const change of changes) {
      this.setNestedValue(updatedTemplate, change.field, change.newValue);
    }

    // Update version metadata
    updatedTemplate.version = this.calculateNextVersion(template.version, 'patch');
    updatedTemplate.metadata.updatedAt = new Date().toISOString();

    return updatedTemplate;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  private calculateDifferences(template1: PromptTemplatesTable, template2: PromptTemplatesTable): FieldChange[] {
    // Simplified difference calculation - in production would use deep comparison
    const differences: FieldChange[] = [];

    if (template1.name !== template2.name) {
      differences.push({
        field: 'name',
        oldValue: template1.name,
        newValue: template2.name,
        impact: 'cosmetic'
      });
    }

    if (template1.templateData !== template2.templateData) {
      differences.push({
        field: 'templateData',
        oldValue: 'Previous template structure',
        newValue: 'Updated template structure',
        impact: 'breaking'
      });
    }

    return differences;
  }

  private summarizeDifferences(differences: FieldChange[]): {
    breaking: number;
    enhancements: number;
    bugfixes: number;
    cosmetic: number;
  } {
    return differences.reduce((summary, diff) => {
      switch (diff.impact) {
        case 'breaking':
          summary.breaking++;
          break;
        case 'enhancement':
          summary.enhancements++;
          break;
        case 'bugfix':
          summary.bugfixes++;
          break;
        case 'cosmetic':
          summary.cosmetic++;
          break;
      }
      return summary;
    }, { breaking: 0, enhancements: 0, bugfixes: 0, cosmetic: 0 });
  }
}

/**
 * Factory function to create versioning service
 */
export function createTemplateVersioningService(
  docClient: DynamoDBDocumentClient,
  templatesTable: string
): TemplateVersioningService {
  return new TemplateVersioningService(docClient, templatesTable);
}

/**
 * Version validation utilities
 */
export const VersionUtils = {
  /**
   * Validates version format (semantic versioning)
   */
  isValidVersion(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    return semverRegex.test(version);
  },

  /**
   * Compares two versions
   */
  compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (v1Parts[i] > v2Parts[i]) return 1;
      if (v1Parts[i] < v2Parts[i]) return -1;
    }
    return 0;
  },

  /**
   * Gets latest version from array
   */
  getLatestVersion(versions: string[]): string {
    return versions.sort((a, b) => this.compareVersions(b, a))[0];
  }
};