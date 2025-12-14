// ABOUTME: BigQuery database connector implementation.
// ABOUTME: Handles authentication, queries, and schema retrieval for Google BigQuery.

import { BigQuery } from '@google-cloud/bigquery';
import type {
  DatabaseConnector,
  ConnectionConfig,
  BigQueryConnectionConfig,
  QueryResult,
  Schema,
  Table,
  Column,
} from '../../shared/types';

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
    if (config.type !== 'bigquery') {
      throw new Error(`Unsupported connection type: ${config.type}`);
    }
    const bqConfig = config as BigQueryConnectionConfig;
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

  async getSchemaWithProgress(
    onProgress: (current: number, total: number) => void
  ): Promise<Schema> {
    if (!this.client || !this.projectId) {
      throw new Error('Not connected to BigQuery');
    }

    console.time('BigQuery: Get datasets');
    const [datasets] = await this.client.getDatasets();
    console.timeEnd('BigQuery: Get datasets');
    console.log(`Found ${datasets.length} datasets`);

    const tables: Table[] = [];
    let completed = 0;
    const total = datasets.length;

    // Fetch datasets in parallel with progress updates
    console.time('BigQuery: Get all tables (parallel with progress)');
    const failedDatasets: Array<{ dataset: string; error: string }> = [];

    await Promise.all(
      datasets.map(async (dataset) => {
        try {
          const [datasetTables] = await dataset.getTables();
          console.log(`Dataset ${dataset.id}: ${datasetTables.length} tables`);

          const datasetTableObjects = datasetTables.map(table => ({
            name: table.id!,
            schema: dataset.id!,
            type: (table.metadata as any)?.type,
            columns: [],
          }));

          tables.push(...datasetTableObjects);
          completed++;
          onProgress(completed, total);
        } catch (err: any) {
          console.error(`Failed to fetch tables for dataset ${dataset.id}:`, err);

          // Check for fatal errors that should stop the whole process
          if (err.code === 401 || err.code === 403 || err.message?.includes('auth')) {
            throw new Error(`Authentication failed while loading schema: ${err.message}`);
          }

          // Track per-dataset errors
          failedDatasets.push({ dataset: dataset.id!, error: err.message });
          completed++;
          onProgress(completed, total);
        }
      })
    );
    console.timeEnd('BigQuery: Get all tables (parallel with progress)');

    // Warn if too many datasets failed
    if (failedDatasets.length > datasets.length / 2) {
      console.warn(`Failed to load ${failedDatasets.length}/${datasets.length} datasets. Connection may be unstable.`);
    }

    console.log(`Total tables: ${tables.length}`);
    return { tables };
  }

  async getTables(): Promise<Table[]> {
    if (!this.client || !this.projectId) {
      throw new Error('Not connected to BigQuery');
    }

    console.time('BigQuery: Get datasets');
    const [datasets] = await this.client.getDatasets();
    console.timeEnd('BigQuery: Get datasets');
    console.log(`Found ${datasets.length} datasets`);

    // Fetch all datasets' tables in parallel
    console.time('BigQuery: Get all tables (parallel)');
    const tablePromises = datasets.map(async (dataset) => {
      try {
        const [datasetTables] = await dataset.getTables();
        console.log(`Dataset ${dataset.id}: ${datasetTables.length} tables`);

        return datasetTables.map(table => ({
          name: table.id!,
          schema: dataset.id!,
          type: (table.metadata as any)?.type,
          columns: [],
        }));
      } catch (err) {
        console.error(`Failed to fetch tables for dataset ${dataset.id}:`, err);
        return [];
      }
    });

    const tableArrays = await Promise.all(tablePromises);
    const tables = tableArrays.flat();
    console.timeEnd('BigQuery: Get all tables (parallel)');

    console.log(`Total tables: ${tables.length}`);
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

    try {
      const [metadata] = await table.getMetadata();

      return metadata.schema?.fields?.map((field: any) => ({
        name: field.name,
        type: field.type,
        nullable: field.mode !== 'REQUIRED',
      })) || [];
    } catch (err) {
      // If metadata fetch fails (e.g., table deleted), return empty array
      console.error(`Failed to fetch columns for ${tableName}:`, err);
      return [];
    }
  }
}
