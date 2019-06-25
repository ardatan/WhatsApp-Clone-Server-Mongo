import { Injectable, Inject, ProviderScope } from '@graphql-modules/di';
import DataLoader from 'dataloader';
import format from 'date-fns/format';
import { Database } from '../common/database.provider';
import { PubSub } from '../common/pubsub.provider';
import { ChatDbObject, MessageDbObject, UserDbObject } from '../../types/graphql';
import { FilterQuery, ObjectID } from 'mongodb';
import { Users } from '../users/users.provider';

type ChatsByUser = { userId: ObjectID };
type ChatByUser = { userId: ObjectID; chatId: ObjectID };
type ChatById = { chatId: ObjectID };
type ChatsKey = ChatById | ChatByUser | ChatsByUser;

function isChatsByUser(query: any): query is ChatsByUser {
  return query.userId && !query.chatId;
}

function isChatByUser(query: any): query is ChatByUser {
  return query.userId && query.chatId;
}

@Injectable({
  scope: ProviderScope.Session,
})
export class Chats {
  @Inject() private db: Database;
  @Inject() private pubsub: PubSub;
  @Inject() private users: Users;

  private get chatsCollection() {
    return this.db.collection<ChatDbObject>('chats');
  }

  private get messagesCollection() {
    return this.db.collection<MessageDbObject>('messages');
  }

  private chatsCache = new Map<string, ChatDbObject>();
  private loaders = {
    chats: new DataLoader<ChatsKey, ChatDbObject[]>(keys => {
      return Promise.all(
        keys.map(async query => {
          if (isChatsByUser(query)) {
            return this._findChatsByUser(query.userId);
          }

          if (this.chatsCache.has(query.chatId.toString())) {
            const cached = this._readChatFromCache(query.chatId);
            return cached ? [cached] : [];
          }

          if (isChatByUser(query)) {
            return this._findChatByUser(query);
          }

          return this._findChatById(query.chatId);
        })
      );
    }),
  };

  async findChatsByUser(userId: ObjectID) {
    return this.loaders.chats.load({ userId });
  }

  private async _findChatsByUser(userId: ObjectID) {
    const rows = await this.chatsCollection.find({
      participantUserIdList: userId
    }).toArray();

    rows.forEach(row => {
      this._writeChatToCache(row);
    });

    return rows;
  }

  async findChatByUser({ chatId, userId }: { chatId: ObjectID; userId: ObjectID }) {
    const rows = await this.loaders.chats.load({ chatId, userId });

    return rows[0] || null;
  }

  private async _findChatByUser({
    chatId,
    userId,
  }: {
    chatId: ObjectID;
    userId: ObjectID;
  }) {
    const rows = await this.chatsCollection.find({
      _id: chatId,
      participantUserIdList: userId,
    }).toArray();

    this._writeChatToCache(rows[0]);

    return rows;
  }

  async findChatById(chatId: ObjectID) {
    const rows = await this.loaders.chats.load({ chatId });
    return rows[0] || null;
  }

  private async _findChatById(chatId: ObjectID) {
    const rows = await this.chatsCollection.find({
      _id: chatId
    }).toArray();

    this._writeChatToCache(rows[0]);

    return rows;
  }

  async findMessagesByChat({
    chatId,
    limit,
    after,
  }: {
    chatId: ObjectID;
    limit: number;
    after?: number | null;
  }): Promise<{
    hasMore: boolean;
    cursor: number | null;
    messages: any[];
  }> {
    const query: FilterQuery<MessageDbObject> = {
      chatId
    };

    if (after) {
      // the created_at is the cursor
      query.createdAt = {
        $lt: cursorToDate(after)
      };
    }

    const messages = await this.messagesCollection.find(query).sort({
      createdAt: 1
    }).limit(limit).toArray();

    if (!messages) {
      return {
        hasMore: false,
        cursor: null,
        messages: [],
      };
    }

    // so we send them as old -> new
    messages.reverse();

    // cursor is a number representation of created_at
    const cursor = messages.length ? new Date(messages[0].createdAt).getTime() : 0;

    const next = await this.messagesCollection.find({
      chatId,
      createdAt: {
        $lt: cursorToDate(
          cursor
        )
      }
    }).sort({
      createdAt: 1
    }).limit(1).toArray();

    return {
      hasMore: next.length === 1, // means there's no more messages
      cursor,
      messages,
    };
  }

  async lastMessage(chatId: ObjectID) {
    return this.messagesCollection.findOne({
      chatId,
    }, {
        sort: {
          createdAt: -1,
        }
      });
  }

  async firstRecipient({ chatId, userId }: { chatId: ObjectID; userId: ObjectID }) {
    const chat = await this.chatsCollection.findOne({
      _id: chatId,
      participantUserIdList: userId,
    });
    const recipientId = chat && chat.participantUserIdList.find(_id => _id.toString() !== userId.toString());
    const recipientUser = recipientId && await this.users.findById(recipientId);

    return recipientUser || null;
  }

  async participants(chatId: ObjectID) {
    const chat = await this.chatsCollection.findOne({
      _id: chatId,
    });
    const participants: UserDbObject[] = [];
    if (chat) {
      for (const userId of chat.participantUserIdList) {
        const user = await this.users.findById(userId);
        if (user) {
          participants.push(user);
        }
      }
    }
    return participants;
  }

  async isParticipant({ chatId, userId }: { chatId: string; userId: string }) {
    const rows = await this.chatsCollection.find({
      _id: chatId,
      participantUserIdList: userId
    }).toArray();

    return !!rows.length;
  }

  async addMessage({
    chatId,
    userId,
    content,
  }: {
    chatId: ObjectID;
    userId: ObjectID;
    content: string;
  }) {

    const { insertedId } = await this.messagesCollection.insertOne({
      chatId,
      createdAt: new Date(),
      senderUserId: userId,
      content,
    } as MessageDbObject)

    const messageAdded = {
      _id: insertedId,
      chatId,
      createdAt: new Date(),
      senderUserId: userId,
      content,
    };

    this.pubsub.publish('messageAdded', {
      messageAdded,
    });

    return messageAdded;
  }

  async addChat({
    userId,
    recipientId,
  }: {
    userId: ObjectID;
    recipientId: ObjectID;
  }) {

    const participantUserIdList = [
      userId,
      recipientId
    ];

    const row = await this.chatsCollection.findOne({
      participantUserIdList
    })

    // If there is already a chat between these two users, return it
    if (row) {
      return row;
    }

    const { insertedId } = await this.chatsCollection.insertOne({
      participantUserIdList
    } as ChatDbObject);

    const chatAdded = {
      _id: insertedId,
      participantUserIdList
    };

    this.pubsub.publish('chatAdded', {
      chatAdded,
    });

    return chatAdded;
  }

  async removeChat({ chatId, userId }: { chatId: ObjectID; userId: ObjectID }) {

    const chat = await this.chatsCollection.findOne({
      _id: chatId,
      participantUserIdList: userId,
    });

    if (!chat) {
      return null;
    }

    await this.messagesCollection.deleteMany({
      chatId,
    });

    await this.chatsCollection.deleteOne({
      _id: chatId,
    })

    this.pubsub.publish('chatRemoved', {
      chatRemoved: chatId,
      targetChat: chat,
    });

    return chatId;
  }

  private _readChatFromCache(chatId: ObjectID) {
    return this.chatsCache.get(chatId.toString());
  }

  private _writeChatToCache(chat?: ChatDbObject) {
    if (chat) {
      this.chatsCache.set(chat._id.toString(), chat);
    }
  }
}

function cursorToDate(cursor: number) {
  return `'${format(cursor, 'YYYY-MM-DD HH:mm:ss')}'`;
}
