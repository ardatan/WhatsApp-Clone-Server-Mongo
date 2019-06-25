import { createTestClient } from 'apollo-server-testing';
import { gql } from 'apollo-server-express';
import { server } from '../../server';
import { resetDb } from '../../db';
import { mockAuth } from '../mocks/auth.provider';

describe('Mutation.addMessage', () => {
  beforeEach(resetDb);

  it('should add message to specified chat', async () => {
    mockAuth('111111111111111111111111');

    const { query, mutate } = createTestClient(server);

    const addMessageRes = await mutate({
      variables: { chatId: '111111111111111111111111', content: 'Hello World' },
      mutation: gql`
        mutation AddMessage($chatId: ID!, $content: String!) {
          addMessage(chatId: $chatId, content: $content) {
            content
          }
        }
      `,
    });

    expect(addMessageRes.data).toBeDefined();
    expect(addMessageRes.errors).toBeUndefined();
    expect(addMessageRes.data).toMatchSnapshot();

    const getChatRes = await query({
      variables: { chatId: '111111111111111111111111' },
      query: gql`
        query GetChat($chatId: ID!) {
          chat(chatId: $chatId) {
            id
            lastMessage {
              content
            }
          }
        }
      `,
    });

    expect(getChatRes.data).toBeDefined();
    expect(getChatRes.errors).toBeUndefined();
    expect(getChatRes.data).toMatchSnapshot();
  });
});
