import { Injectable, Inject, ProviderScope } from '@graphql-modules/di';
import bcrypt from 'bcrypt';
import { Database } from '../common/database.provider';
import { ObjectID } from 'mongodb';
import { UserDbObject } from '../../types/graphql';

const DEFAULT_PROFILE_PIC = 'https://raw.githubusercontent.com/Urigo/WhatsApp-Clone-Client-React/legacy/public/assets/default-profile-pic.jpg'

@Injectable({
  scope: ProviderScope.Session,
})
export class Users {
  @Inject() private db: Database;

  private get usersCollection() {
    return this.db.collection<UserDbObject>('users');
  }

  async findById(userId: ObjectID) {
    return this.usersCollection.findOne({ _id: userId }) || null;
  }

  async findAllExcept(userId: ObjectID) {
    return this.usersCollection.find({ _id: { $ne: userId } }).toArray();
  }

  async findByUsername(username: string) {
    return (await this.usersCollection.findOne({ username })) || null;
  }

  async newUser({
    username,
    name,
    password,
  }: {
    username: string;
    name: string;
    password: string;
  }) {
    const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(8));
    const { insertedId } = await this.usersCollection.insertOne({
      password: passwordHash,
      picture: DEFAULT_PROFILE_PIC,
      username,
      name,
    } as UserDbObject);

    return {
      _id: insertedId,
      picture: DEFAULT_PROFILE_PIC,
      username,
      name,
    } as UserDbObject;
  }
}
