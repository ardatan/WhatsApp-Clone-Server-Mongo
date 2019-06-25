import { createTestClient } from 'apollo-server-testing';
import { gql } from 'apollo-server-express';
import { server } from '../../server';
import { resetDb } from '../../db';
import { mockAuth } from '../mocks/auth.provider';

describe('Mutation.addChat', () => {
  beforeEach(resetDb);

  it('creates a new chat between current user and specified recipient', async () => {
    mockAuth('222222222222222222222222');

    const { query, mutate } = createTestClient(server);

    const addChatRes = await mutate({
      variables: { recipientId: '333333333333333333333333' },
      mutation: gql`
        mutation AddChat($recipientId: ID!) {
          addChat(recipientId: $recipientId) {
            name
            participants {
              id
            }
          }
        }
      `,
    });

    expect(addChatRes.data).toBeDefined();
    expect(addChatRes.errors).toBeUndefined();
    expect(addChatRes.data).toMatchSnapshot();
  });

  it('returns the existing chat if so', async () => {
    mockAuth('111111111111111111111111');

    const { query, mutate } = createTestClient(server);

    const addChatRes = await mutate({
      variables: { recipientId: '222222222222222222222222' },
      mutation: gql`
        mutation AddChat($recipientId: ID!) {
          addChat(recipientId: $recipientId) {
            name
            participants {
              id
            }
          }
        }
      `,
    });

    expect(addChatRes.data).toBeDefined();
    expect(addChatRes.errors).toBeUndefined();
    expect(addChatRes.data).toMatchSnapshot();
  });
});
