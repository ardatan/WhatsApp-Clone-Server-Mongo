import { GraphQLModule } from '@graphql-modules/core';
import { gql } from 'apollo-server-express';
import commonModule from '../common';
import { Resolvers } from '../../types/graphql';
import { Users } from './users.provider';
import { Auth } from './auth.provider';

const typeDefs = gql`
  type User @entity(additionalFields: [{ path: "password", type: "string" }, { path: "username", type: "string" }]) {
    id: ID! @id
    name: String! @column
    picture: String @column
  }

  extend type Query {
    me: User
    users: [User!]!
  }

  extend type Mutation {
    signIn(username: String!, password: String!): User
    signUp(
      name: String!
      username: String!
      password: String!
      passwordConfirm: String!
    ): User
  }
`;

const resolvers: Resolvers = {
  User: {
    id: user => user._id.toString(),
  },
  Query: {
    me(root, args, { injector }) {
      return injector.get(Auth).currentUser();
    },
    async users(root, args, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return [];

      return injector.get(Users).findAllExcept(currentUser._id);
    },
  },
  Mutation: {
    async signIn(root, { username, password }, { injector }) {
      return injector.get(Auth).signIn({ username, password });
    },

    async signUp(
      root,
      { name, username, password, passwordConfirm },
      { injector }
    ) {
      return injector
        .get(Auth)
        .signUp({ name, username, password, passwordConfirm });
    },
  },
};

export default new GraphQLModule({
  name: 'users',
  typeDefs,
  resolvers,
  imports: () => [commonModule],
  providers: () => [Users, Auth],
});
