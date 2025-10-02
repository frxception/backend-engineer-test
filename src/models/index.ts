import { Pool } from 'pg';
import { BlockModel } from './block.model.ts';
import { TransactionModel } from './transaction.model.ts';
import { OutputModel } from './output.model.ts';

export class DatabaseService {
  private blockModel: BlockModel;
  private transactionModel: TransactionModel;
  private outputModel: OutputModel;

  constructor(private pool: Pool) {
    this.blockModel = new BlockModel(pool);
    this.transactionModel = new TransactionModel(pool);
    this.outputModel = new OutputModel(pool);
  }

  async initializeTables(): Promise<void> {
    await this.blockModel.initializeTables();
    await this.transactionModel.initializeTables();
    await this.outputModel.initializeTables();
  }

  async insertBlock(block: any): Promise<void> {
    return this.blockModel.insert(block);
  }

  async getCurrentHeight(): Promise<number> {
    return this.blockModel.getCurrentHeight();
  }

  async getAddressBalance(address: string): Promise<number> {
    return this.outputModel.getAddressBalance(address);
  }

  get blocks() {
    return this.blockModel;
  }

  get transactions() {
    return this.transactionModel;
  }

  get outputs() {
    return this.outputModel;
  }
}

export { BlockModel } from './block.model.ts';
export { TransactionModel } from './transaction.model.ts';
export { OutputModel } from './output.model.ts';
