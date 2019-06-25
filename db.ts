import { createPool } from 'generic-pool';
import faker from 'faker';
import addMinutes from 'date-fns/add_minutes';
import { resetDb as envResetDb, fakedDb } from './env';
import { MongoClient, ObjectID } from 'mongodb';
import { MessageDbObject, UserDbObject, ChatDbObject } from './types/graphql';

export let pool = createPool({
  create: () => MongoClient.connect('mongodb://localhost:27017/whatsapp'),
  destroy: client => client.close(),
}, {
  max : 15,
  idleTimeoutMillis : 30000
})

export const resetDb = async () => {
  const mongodb = await pool.acquire();
  const db = mongodb.db();

  const messages = db.collection<MessageDbObject>('messages');
  const users = db.collection<UserDbObject>('users');
  const chats = db.collection<ChatDbObject>('chats');

  // Clear tables
  await users.deleteMany({});

  const sampleUsers = [
    {
      _id: new ObjectID('111111111111111111111111'),
      name: 'Ray Edwards',
      username: 'ray',
      password: '$2a$08$NO9tkFLCoSqX1c5wk3s7z.JfxaVMKA.m7zUDdDwEquo4rvzimQeJm', // 111
      picture: 'https://randomuser.me/api/portraits/thumb/lego/1.jpg',
    },
    {
      _id: new ObjectID('222222222222222222222222'),
      name: 'Ethan Gonzalez',
      username: 'ethan',
      password: '$2a$08$xE4FuCi/ifxjL2S8CzKAmuKLwv18ktksSN.F3XYEnpmcKtpbpeZgO', // 222
      picture: 'https://randomuser.me/api/portraits/thumb/men/1.jpg',
    },
    {
      _id: new ObjectID('333333333333333333333333'),
      name: 'Bryan Wallace',
      username: 'bryan',
      password: '$2a$08$UHgH7J8G6z1mGQn2qx2kdeWv0jvgHItyAsL9hpEUI3KJmhVW5Q1d.', // 333
      picture: 'https://randomuser.me/api/portraits/thumb/men/2.jpg',
    },
    {
      _id: new ObjectID('444444444444444444444444'),
      name: 'Avery Stewart',
      username: 'avery',
      password: '$2a$08$wR1k5Q3T9FC7fUgB7Gdb9Os/GV7dGBBf4PLlWT7HERMFhmFDt47xi', // 444
      picture: 'https://randomuser.me/api/portraits/thumb/women/1.jpg',
    },
    {
      _id: new ObjectID('555555555555555555555555'),
      name: 'Katie Peterson',
      username: 'katie',
      password: '$2a$08$6.mbXqsDX82ZZ7q5d8Osb..JrGSsNp4R3IKj7mxgF6YGT0OmMw242', // 555
      picture: 'https://randomuser.me/api/portraits/thumb/women/2.jpg',
    },
  ];

  await users.insertMany(sampleUsers);

  await chats.deleteMany({});

  const sampleChats = [
    {
      _id: new ObjectID('111111111111111111111111'),
      participantUserIdList: [new ObjectID('111111111111111111111111'), new ObjectID('222222222222222222222222')]
    },
    {
      _id: new ObjectID('222222222222222222222222'),
      participantUserIdList: [new ObjectID('111111111111111111111111'), new ObjectID('333333333333333333333333')]
    },
    {
      _id: new ObjectID('333333333333333333333333'),
      participantUserIdList: [new ObjectID('111111111111111111111111'), new ObjectID('444444444444444444444444')]
    },
    {
      _id: new ObjectID('444444444444444444444444'),
      participantUserIdList: [new ObjectID('111111111111111111111111'), new ObjectID('555555555555555555555555')]
    },
  ];

  await chats.insertMany(sampleChats);

  await messages.deleteMany({});

  const baseTime = new Date('1 Jan 2019 GMT').getTime();

  const sampleMessages = [
    {
      _id: new ObjectID('111111111111111111111111'),
      content: 'You on your way?',
      createdAt: new Date(baseTime - 60 * 1000 * 1000),
      chatId: new ObjectID('111111111111111111111111'),
      senderUserId: new ObjectID('111111111111111111111111'),
    },
    {
      _id: new ObjectID('222222222222222222222222'),
      content: "Hey, it's me",
      createdAt: new Date(baseTime - 2 * 60 * 1000 * 1000),
      chatId: new ObjectID('222222222222222222222222'),
      senderUserId: new ObjectID('111111111111111111111111'),
    },
    {
      _id: new ObjectID('333333333333333333333333'),
      content: 'I should buy a boat',
      createdAt: new Date(baseTime - 24 * 60 * 1000 * 1000),
      chatId: new ObjectID('333333333333333333333333'),
      senderUserId: new ObjectID('111111111111111111111111'),
    },
    {
      _id: new ObjectID('444444444444444444444444'),
      content: 'This is wicked good ice cream.',
      createdAt: new Date(baseTime - 14 * 24 * 60 * 1000 * 1000),
      chatId: new ObjectID('444444444444444444444444'),
      senderUserId: new ObjectID('111111111111111111111111'),
    },
  ];

  if (fakedDb) {
    addFakedMessages(sampleMessages, fakedDb);
  }

  await messages.insertMany(sampleMessages);
  
  await pool.release(mongodb);
};

function addFakedMessages(messages: MessageDbObject[], count: number) {
  const message = messages[0];
  const date = message.createdAt;
  const id = messages.length + 1;

  new Array(count).fill(0).forEach((_, i) => {
    messages.push({
      ...message,
      _id: new ObjectID(`${id + i}`),
      content: faker.lorem.sentence(4),
      createdAt: addMinutes(date, i + 1),
    });
  });
}

if (envResetDb) {
  resetDb();
}
