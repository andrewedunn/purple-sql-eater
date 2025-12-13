// ABOUTME: BigQuery database connector implementation.
// ABOUTME: Handles authentication, queries, and schema retrieval for Google BigQuery.

import { BigQuery } from '@google-cloud/bigquery';
import type {
  DatabaseConnector,
  ConnectionConfig,
  QueryResult,
  Schema,
  Table,
  Column,
} from '../../shared/types';

export interface BigQueryConfig extends ConnectionConfig {
  type: 'bigquery';
  projectId: string;
  keyFilename?: string;
  credentials?: object;
}

export class BigQueryConnector implements DatabaseConnector {
  private client: BigQuery | null = null;
  private projectId: string | null = null;

  private serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object' && value !== null) {
      if ('value' in value && typeof (value as any).value !== 'undefined') {
        return this.serializeValue((value as any).value);
      }

      if (Array.isArray(value)) {
        return value.map((item) => this.serializeValue(item));
      }

      const serialized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        serialized[key] = this.serializeValue(val);
      }
      return serialized;
    }

    return value;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const bqConfig = config as BigQueryConfig;
    this.projectId = bqConfig.projectId;

    const options: any = {
      projectId: bqConfig.projectId,
    };

    if (bqConfig.keyFilename) {
      options.keyFilename = bqConfig.keyFilename;
    } else if (bqConfig.credentials) {
      options.credentials = bqConfig.credentials;
    }

    this.client = new BigQuery(options);
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.projectId = null;
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to BigQuery');
    }

    const [job] = await this.client.createQueryJob({ query: sql });
    const [rows] = await job.getQueryResults();

    if (rows.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
      };
    }

    const columns = Object.keys(rows[0]);

    const jsonSafeRows = JSON.parse(JSON.stringify(rows, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    const formattedRows = jsonSafeRows.map((row: any) =>
      columns.map((col) => row[col])
    );

    return {
      columns,
      rows: formattedRows,
      rowCount: rows.length,
    };
  }

  async getSchema(): Promise<Schema> {
    const tables = await this.getTables();
    return { tables };
  }

  async getTables(): Promise<Table[]> {
    if (!this.client || !this.projectId) {
      throw new Error('Not connected to BigQuery');
    }

    const [datasets] = await this.client.getDatasets();
    const tables: Table[] = [];

    for (const dataset of datasets) {
      const [datasetTables] = await dataset.getTables();

      for (const table of datasetTables) {
        const [metadata] = await table.getMetadata();
        const columns: Column[] = metadata.schema.fields.map((field: any) => ({
          name: field.name,
          type: field.type,
          nullable: field.mode !== 'REQUIRED',
        }));

        tables.push({
          name: table.id!,
          schema: dataset.id!,
          columns,
        });
      }
    }

    return tables;
  }

  async getColumns(tableName: string): Promise<Column[]> {
    if (!this.client) {
      throw new Error('Not connected to BigQuery');
    }

    const [datasetId, tableId] = tableName.split('.');
    if (!datasetId || !tableId) {
      throw new Error('Table name must be in format: dataset.table');
    }

    const dataset = this.client.dataset(datasetId);
    const table = dataset.table(tableId);
    const [metadata] = await table.getMetadata();

    return metadata.schema.fields.map((field: any) => ({
      name: field.name,
      type: field.type,
      nullable: field.mode !== 'REQUIRED',
    }));
  }
}
