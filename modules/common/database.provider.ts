import { Injectable, ProviderScope } from '@graphql-modules/di';
import { OnResponse } from '@graphql-modules/core';
import { MongoClient, Collection } from 'mongodb';
import { Pool } from 'generic-pool';

@Injectable({
  scope: ProviderScope.Session,
})
export class Database implements OnResponse {
  private instance: MongoClient;

  constructor(private pool: Pool<MongoClient>) {}

  async onRequest() {
    this.instance = await this.pool.acquire();
  }

  onResponse() {
    if (this.instance) {
      this.pool.release(this.instance);
    }
  }

  private getClient() {
    return this.instance;
  }

  collection<T>(collectionName: string): Collection<T> {
    return this.instance.db().collection(collectionName);
  }
}
