import { Auth } from './../../modules/users/auth.provider';
import usersModule from './../../modules/users';
import { pool } from '../../db';
import { ObjectID } from 'mongodb';
import { Injectable, Inject } from '@graphql-modules/di';
import { Database } from '../../modules/common/database.provider';
import { Users } from '../../modules/users/users.provider';

export function mockAuth(userId: string) {
  @Injectable()
  class AuthMock extends Auth {
    async currentUser() {
      const user = await this.users.findById(new ObjectID(userId));
      return user;
    }
  }

  usersModule.injector.provide({
    provide: Auth,
    useClass: AuthMock,
    overwrite: true,
  });
}
