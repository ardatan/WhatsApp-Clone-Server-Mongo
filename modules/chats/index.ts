import { GraphQLModule } from '@graphql-modules/core';
import { gql, withFilter } from 'apollo-server-express';
import commonModule from '../common';
import usersModule from '../users';
import { Resolvers, MessageDbObject, ChatDbObject } from '../../types/graphql';
import { UnsplashApi } from './unsplash.api';
import { Users } from './../users/users.provider';
import { Auth } from './../users/auth.provider';
import { Chats } from './chats.provider';
import { PubSub } from '../common/pubsub.provider';
import { ObjectID } from 'bson';

const typeDefs = gql`
  type Message @entity {
    id: ID! @id
    content: String! @column
    createdAt: DateTime! @column
    chat: Chat! @link @map(path: "chatId")
    sender: User @link @map(path: "senderUserId")
    recipient: User
    isMine: Boolean!
  }

  type MessagesResult {
    cursor: Float
    hasMore: Boolean!
    messages: [Message!]! @link
  }

  type Chat @entity {
    id: ID! @id
    name: String @column
    picture: String @column
    lastMessage: Message
    messages(limit: Int!, after: Float): MessagesResult!
    participants: [User!]! @link @map(path: "participantUserIdList")
  }

  extend type Query {
    chats: [Chat!]!
    chat(chatId: ID!): Chat
  }

  extend type Mutation {
    addMessage(chatId: ID!, content: String!): Message
    addChat(recipientId: ID!): Chat
    removeChat(chatId: ID!): ID
  }

  extend type Subscription {
    messageAdded: Message!
    chatAdded: Chat!
    chatRemoved: ID!
  }
`;

const resolvers: Resolvers = {
  Message: {
    id: message => message._id.toString(),
    createdAt(message) {
      return new Date(message.createdAt);
    },

    async chat(message, args, { injector }) {
      return injector.get(Chats).findChatById(message.chatId);
    },

    async sender(message, args, { injector }) {
      return injector.get(Users).findById(message.senderUserId!);
    },

    async recipient(message, args, { injector }) {
      return injector.get(Chats).firstRecipient({
        chatId: message.chatId,
        userId: message.senderUserId!,
      });
    },

    async isMine(message, args, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();
      return message.senderUserId === currentUser!._id;
    },
  },

  Chat: {
    id: chat => chat._id.toString(),
    async name(chat, args, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return null;

      const participant = await injector.get(Chats).firstRecipient({
        chatId: chat._id,
        userId: currentUser._id,
      });

      return participant ? participant.name : null;
    },

    async picture(chat, args, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return null;

      const participant = await injector.get(Chats).firstRecipient({
        chatId: chat._id,
        userId: currentUser._id,
      });

      return participant && participant.picture
        ? participant.picture
        : injector.get(UnsplashApi).getRandomPhoto();
    },

    async messages(chat, args, { injector }) {
      return injector.get(Chats).findMessagesByChat({
        chatId: chat._id,
        limit: args.limit,
        after: args.after,
      });
    },

    async lastMessage(chat, args, { injector }) {
      return injector.get(Chats).lastMessage(chat._id);
    },

    async participants(chat, args, { injector }) {
      return injector.get(Chats).participants(chat._id);
    },
  },

  Query: {
    async chats(root, args, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return [];

      return injector.get(Chats).findChatsByUser(currentUser._id);
    },

    async chat(root, { chatId }, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return null;

      return injector
        .get(Chats)
        .findChatByUser({ chatId: new ObjectID(chatId), userId: currentUser._id });
    },
  },

  Mutation: {
    async addMessage(root, { chatId, content }, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return null;

      return injector
        .get(Chats)
        .addMessage({ chatId: new ObjectID(chatId), content, userId: currentUser._id });
    },

    async addChat(root, { recipientId }, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return null;

      return injector
        .get(Chats)
        .addChat({ recipientId: new ObjectID(recipientId), userId: currentUser._id });
    },

    async removeChat(root, { chatId }, { injector }) {
      const currentUser = await injector.get(Auth).currentUser();

      if (!currentUser) return null;

      await injector.get(Chats).removeChat({ chatId: new ObjectID(chatId), userId: currentUser._id });

      return chatId;
    },
  },

  Subscription: {
    messageAdded: {
      subscribe: withFilter(
        (root, args, { injector }) =>
          injector.get(PubSub).asyncIterator('messageAdded'),
        async (
          { messageAdded }: { messageAdded: MessageDbObject },
          args,
          { injector }
        ) => {
          const currentUser = await injector.get(Auth).currentUser();

          if (!currentUser) return false;

          return injector.get(Chats).isParticipant({
            chatId: messageAdded.chatId,
            userId: currentUser.id,
          });
        }
      ),
    },

    chatAdded: {
      subscribe: withFilter(
        (root, args, { injector }) =>
          injector.get(PubSub).asyncIterator('chatAdded'),
        async ({ chatAdded }: { chatAdded: ChatDbObject }, args, { injector }) => {
          const currentUser = await injector.get(Auth).currentUser();

          if (!currentUser) return false;

          return injector.get(Chats).isParticipant({
            chatId: chatAdded._id,
            userId: currentUser._id,
          });
        }
      ),
    },

    chatRemoved: {
      subscribe: withFilter(
        (root, args, { injector }) =>
          injector.get(PubSub).asyncIterator('chatRemoved'),
        async ({ targetChat }: { targetChat: ChatDbObject }, args, { injector }) => {
          const currentUser = await injector.get(Auth).currentUser();

          if (!currentUser) return false;

          return injector.get(Chats).isParticipant({
            chatId: targetChat._id,
            userId: currentUser.id,
          });
        }
      ),
    },
  },
};

export default new GraphQLModule({
  name: 'chats',
  typeDefs,
  resolvers,
  imports: () => [commonModule, usersModule],
  providers: () => [UnsplashApi, Chats],
});
