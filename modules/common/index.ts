import { GraphQLModule } from '@graphql-modules/core';
import { gql } from 'apollo-server-express';
import { GraphQLDateTime } from 'graphql-iso-date';
import { Pool } from 'generic-pool';
import { pool } from '../../db';
import { Resolvers } from '../../types/graphql';
import { Database } from './database.provider';
import { PubSub } from './pubsub.provider';
import { DIRECTIVES } from '@graphql-codegen/typescript-mongodb';

const typeDefs = gql`
  scalar DateTime

  type Query {
    _dummy: Boolean
  }

  type Mutation {
    _dummy: Boolean
  }

  type Subscription {
    _dummy: Boolean
  }

  ${DIRECTIVES}
`;

const resolvers: Resolvers = {
  DateTime: GraphQLDateTime,
};

export default new GraphQLModule({
  name: 'common',
  typeDefs,
  resolvers,
  providers: () => [
    {
      provide: Pool,
      useValue: pool,
    },
    PubSub,
    Database,
  ],
});
