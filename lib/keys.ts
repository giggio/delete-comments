import * as azure from 'azure-storage';
import { promisify } from 'bluebird';
if (!(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_ACCESS_KEY) && !process.env.AZURE_STORAGE_CONNECTION_STRING)
    process.env.AZURE_STORAGE_CONNECTION_STRING = azure.generateDevelopmentStorageCredentials();
const tableService = azure.createTableService();
const insertOrReplaceEntity = promisify(tableService.insertOrReplaceEntity, { context: tableService });
const retrieveEntity = promisify(tableService.retrieveEntity, { context: tableService });
const doesTableExist = promisify(tableService.doesTableExist, { context: tableService });
const createTable = promisify(tableService.createTable, { context: tableService });

export class Keys {
    private readonly tableName = 'keys';
    private readonly entGen = azure.TableUtilities.entityGenerator;

    async init() {
        const existResult = await doesTableExist(this.tableName);
        if (!existResult.exists) {
            await createTable(this.tableName);
            await this.setUserAccessToken('');
        } else {
            try {
                await this.getUserAccessToken();
            } catch (error) {
                if (error.statusCode === 404)
                    await this.setUserAccessToken('');
            }
        }
    }

    async getUserAccessToken() {
        const entity = await retrieveEntity(this.tableName, 'keys', 'accesskey');
        return <string>entity.Value._;
    }

    async setUserAccessToken(key: string) {
        const entity = {
            PartitionKey: this.entGen.String('keys'),
            RowKey: this.entGen.String('accesskey'),
            Value: this.entGen.String(key),
            Update: this.entGen.DateTime(new Date())
        };
        await insertOrReplaceEntity(this.tableName, entity);
    }
}